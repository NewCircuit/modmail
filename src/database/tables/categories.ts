import { PoolClient } from 'pg';
import { SnowflakeUtil } from 'discord.js';
import Table from '../../models/table';
import { CategoryID } from '../../models/identifiers';
import {
  Category,
  CategoryResolvable,
  CreateCategoryOpt,
  DBCategory,
} from '../../models/types';
import Modmail from '../../Modmail';

export default class CategoryManager extends Table {
  constructor(modmail: Modmail, pool: PoolClient) {
    super(modmail, pool, 'categories');
  }

  /**
   * Handles added attachments and sends them.
   * @method create
   * @param {CreateCategoryOpt} opt Required options for a new category
   * @returns {Promise<Category>}
   * @throws {Error} A Postgres-related error, mostly from constraint issues.
   */
  public async create(opt: CreateCategoryOpt): Promise<Category> {
    const categoryID = SnowflakeUtil.generate(Date.now());
    const {
      name, guildID, emote, channelID,
    } = opt;
    await this.pool.query(
      `INSERT INTO ${this.name} (id, name, guild_id, emote, channel_id)`
      + ' VALUES ($1, $2, $3, $4, $5)',
      [categoryID, name, guildID, emote, channelID],
    );

    return {
      channelID,
      emojiID: emote,
      guildID,
      id: categoryID,
      isActive: true,
      name,
    };
  }

  /**
   * Set the activity of a category based on a provided emote.
   * @param {string} emoji
   * @param {boolean} active
   * @returns {Promise<void>}
   * @throws {Error} if nothing was updated
   */
  public async setActive(id: string, active: boolean): Promise<void> {
    const res = await this.pool.query(
      `UPDATE ${this.name} SET is_active=$2 WHERE id=$1`,
      [id, active],
    );

    if (res.rowCount === 0) {
      throw new Error('Nothing was updated');
    }
  }

  /**
   * Set a unique emote for a given category.
   * @param {CategoryID} id Category identifier
   * @param {string} emote New unique emote
   * @returns {Promise<void>}
   * @throws {Error} If nothing was updated
   */
  public async setEmote(id: CategoryID, emote: string): Promise<void> {
    const res = await this.pool.query(
      `UPDATE ${this.name} SET emote = $1 WHERE id = $2`,
      [emote, id],
    );

    if (res.rowCount === 0) {
      throw new Error('Nothing was updated');
    }
  }

  /**
   * Set a unique name for a given category.
   * @param {CategoryID} id Targetted category
   * @param {string} name A new unique name
   * @returns {Promise<void>}
   * @throws {Error} If nothing was updated
   */
  public async setName(id: CategoryID, name: string): Promise<void> {
    const res = await this.pool.query(
      `UPDATE ${this.name} SET name = $1 WHERE id = $2`,
      [name, id],
    );

    if (res.rowCount === 0) {
      throw new Error('Nothing was updated');
    }
  }

  /**
   * @method fetchAll
   * @param {CategoryResolvable} by
   * @param {string} id
   * @returns {Promise<Category[]>}
   * @throws {Error} If nothing is resolved
   */
  public async fetchAll(by: CategoryResolvable, id: string): Promise<Category[]> {
    const target = CategoryManager.resolve(by);
    let parsed: null | boolean = null;

    if (by === CategoryResolvable.activity) {
      parsed = id === 'true';
    }

    const res = await this.pool.query(
      `SELECT * FROM ${this.name} WHERE ${target} = $1`,
      [parsed || id],
    );

    if (res.rowCount === 0) {
      return [];
    }

    return res.rows.map(CategoryManager.parse);
  }

  /**
   * @method fetch
   * @param {CategoryResolvable} by
   * @param {string} id
   * @throws {Error} If nothing is resolved
   */
  public async fetch(by: CategoryResolvable, id: string): Promise<Category | null> {
    const res = await this.fetchAll(by, id);

    if (res.length === 0) {
      return null;
    }

    return res[0];
  }

  /**
   * Initialize the categories table if it doesn't exist
   */
  protected async init(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.name} (`
      + ' id bigint not null constraint categories_pk primary key,'
      + ' channel_id bigint unique not null,'
      + ' name text not null,'
      + ' is_active boolean default true not null,'
      + ' guild_id bigint not null,'
      + ' emote text not null)',
    );

    await this.pool.query(
      `create unique index categories_emote_uindex on ${this.name} (emote);`,
    );

    await this.pool.query(
      `create unique index categories_id_uindex on ${this.name} (id);`,
    );

    await this.pool.query(
      `create unique index categories_name_uindex on ${this.name} (name);`,
    );
  }

  /**
   * @param {CategoryResolvable} resolvable
   * @returns {string}
   */
  private static resolve(resolvable: CategoryResolvable): string {
    switch (resolvable) {
      case CategoryResolvable.name:
        return 'name';
      case CategoryResolvable.channel:
        return 'channel_id';
      case CategoryResolvable.emote:
        return 'emote';
      case CategoryResolvable.activity:
        return 'is_active';
      case CategoryResolvable.id:
        return 'id';
      case CategoryResolvable.guild:
        return 'guild_id';
      default:
        throw new Error('An invalid resolvable was provided.');
    }
  }

  /**
   * @method parse
   * @param {DBCatergory} data
   * @returns {Category}
   */
  private static parse(data: DBCategory): Category {
    return {
      channelID: data.channel_id,
      emojiID: data.emote,
      guildID: data.guild_id,
      id: data.id,
      isActive: true,
      name: data.name,
    };
  }
}
