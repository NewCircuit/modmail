import { Category } from '@newcircuit/modmail-types';
import { Pool } from 'pg';
import { SnowflakeUtil } from 'discord.js';
import Table from '../table';
import {
  CreateCategoryOpt,
  DBCategory,
} from '../types';

export default class CategoriesTable extends Table {
  constructor(pool: Pool) {
    super(pool, 'categories');
  }

  /**
   * Handles added attachments and sends them.
   * @method create
   * @param {CreateCategoryOpt} opt Required options for a new category
   * @returns {Promise<Category>}
   */
  public async create(opt: CreateCategoryOpt): Promise<Category> {
    const client = await this.getClient();
    const categoryID = SnowflakeUtil.generate(Date.now());
    const {
      name,
      guildID,
      emoji,
      channelID,
    } = opt;
    const desc = opt.description || '';
    const isPrivate = opt.isPrivate !== undefined
      ? opt.isPrivate
      : false;

    try {
      await client.query(
        `INSERT INTO modmail.categories (id, name, description, guild_id, emoji,
                                         channel_id, is_private)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [categoryID, name, desc, guildID, emoji, channelID, isPrivate],
      );

      return {
        channelID,
        description: desc,
        emojiID: emoji,
        guildID,
        id: categoryID,
        isActive: true,
        isPrivate,
        name,
      };
    } finally {
      client.release();
    }
  }

  public async deactivate(id: string): Promise<boolean> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `UPDATE modmail.categories
         SET is_active = false
         WHERE id = $1`,
        [id],
      );
      await client.query(
        `UPDATE modmail.categories
         SET channel_id = null
         WHERE id = $1`,
        [id],
      );

      return res.rowCount !== 0;
    } finally {
      client.release();
    }

  }

  public async reactivate(id: string, channelID: string): Promise<boolean> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `UPDATE modmail.categories
         SET is_active  = true,
             channel_id = $2
         WHERE id = $1`,
        [id, channelID],
      );

      return res.rowCount !== 0;
    } finally {
      client.release();
    }
  }

  /**
   * Set a unique emoji for a given category.
   * @param {string} id Category identifier
   * @param {string} emoji New unique emote
   * @returns {Promise<boolean>} Whether or not something changed
   */
  public async setEmote(id: string, emoji: string): Promise<boolean> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `UPDATE modmail.categories
         SET emoji = $1
         WHERE id = $2`,
        [emoji, id],
      );

      return res.rowCount !== 0;
    } finally {
      client.release();
    }
  }

  /**
   * Set a unique name for a given category.
   * @param {string} id Targeted category
   * @param {string} name A new unique name
   * @returns {Promise<boolean>}
   */
  public async setName(id: string, name: string): Promise<boolean> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `UPDATE modmail.categories
         SET name = $1
         WHERE id = $2`,
        [name, id],
      );

      return res.rowCount !== 0;
    } finally {
      client.release();
    }
  }

  public async setPrivate(id: string, isPrivate: boolean): Promise<boolean> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `UPDATE modmail.categories
         SET is_private = $1
         WHERE id = $2`,
        [isPrivate, id],
      );

      return res.rowCount !== 0;
    } finally {
      client.release();
    }
  }

  public async fetchAll(activeOnly = true): Promise<Category[]> {
    const client = await this.getClient();
    let res;

    try {
      if (activeOnly) {
        res = await client.query(
          "SELECT * FROM modmail.categories WHERE is_active = true;",
        );
      } else {
        res = await client.query("SELECT * FROM modmail.categories;");
      }
      if (res.rowCount === 0) {
        return [];
      }

      return res.rows.map((cat) => CategoriesTable.parse(cat));
    } finally {
      client.release();
    }
  }

  /**
   * @method fetchByID
   * @param {string} id
   * @returns {Promise<Category | null>}
   */
  public async fetchByID(id: string): Promise<Category | null> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `SELECT *
         FROM modmail.categories
         WHERE id = $1`,
        [id],
      );

      if (res.rowCount === 0) {
        return null;
      }

      return CategoriesTable.parse(res.rows[0]);
    } finally {
      client.release();
    }
  }

  public async fetchByEmoji(emoji: string): Promise<Category | null> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `SELECT *
         FROM modmail.categories
         WHERE emoji = $1`,
        [emoji],
      );

      if (res.rowCount === 0) {
        return null;
      }

      return CategoriesTable.parse(res.rows[0]);
    } finally {
      client.release();
    }
  }

  public async fetchByGuild(guildID: string): Promise<Category | null> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `SELECT *
         FROM modmail.categories
         WHERE guild_id = $1`,
        [guildID],
      );

      if (res.rowCount === 0) {
        return null;
      }

      return CategoriesTable.parse(res.rows[0]);
    } finally {
      client.release();
    }
  }

  public async fetchByName(name: string): Promise<Category | null> {
    const client = await this.getClient();

    try {
      const res = await client.query(
        `SELECT *
         FROM modmail.categories
         WHERE name = $1`,
        [name],
      );

      if (res.rowCount === 0) {
        return null;
      }

      return CategoriesTable.parse(res.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Initialize the categories table if it doesn't exist
   */
  protected async init(): Promise<void> {
    const client = await this.getClient();

    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS modmail.categories
         (
             id          BIGINT                NOT NULL
                 CONSTRAINT categories_pk PRIMARY KEY,
             channel_id  BIGINT UNIQUE,
             name        TEXT UNIQUE           NOT NULL,
             is_active   BOOLEAN DEFAULT true  NOT NULL,
             is_private  BOOLEAN DEFAULT false NOT NULL,
             guild_id    BIGINT                NOT NULL,
             emoji       TEXT UNIQUE           NOT NULL,
             description TEXT    DEFAULT ''    NOT NULL
         );`,
      );
    } finally {
      client.release();
    }
  }

  protected async migrate(): Promise<void> {
    const client = await this.getClient();
    let count;
    let res;

    try {
      // Add description column
      await client.query(
        `ALTER TABLE modmail.categories
            ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '' NOT NULL;`,
      );

      // Make channel_id nullable
      await client.query(
        `ALTER TABLE modmail.categories
            ALTER COLUMN channel_id DROP NOT NULL;`,
      );

      // make inactive categories channel_id nullable
      await client.query(
        `UPDATE modmail.categories
         SET channel_id = null
         WHERE is_active = false;`,
      );

      // make only guild per category
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS categories_guild_id_uindex
            ON modmail.categories (guild_id);`,
      );

      // rename emote to emoji
      res = await client.query(
        `SELECT COUNT(*)
         FROM information_schema.columns
         WHERE table_schema = 'modmail'
           AND column_name = 'emote'
           AND table_name = 'categories'`,
      );
      count = res.rows[0].count;

      if (count > 0) {
        // noinspection SqlResolve
        await client.query(
          `ALTER TABLE modmail.categories
              RENAME COLUMN emote TO emoji;`
        );
      }

      // add private categories
      await client.query(
        `ALTER TABLE modmail.categories
            ADD COLUMN IF NOT EXISTS is_private BOOL DEFAULT false NOT NULL;`,
      );
    } finally {
      client.release();
    }
  }

  /**
   * @method parse
   * @param {DBCategory} data
   * @returns {Category}
   */
  private static parse(data: DBCategory): Category {
    return {
      isPrivate: data.is_private,
      channelID: data.channel_id ? data.channel_id.toString() : null,
      emojiID: data.emoji,
      description: data.description,
      guildID: data.guild_id.toString(),
      id: data.id.toString(),
      isActive: data.is_active,
      name: data.name,
    };
  }
}
