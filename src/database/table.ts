import {
  Pool,
  PoolClient,
} from 'pg';

/**
 * Table represents a table in the database which is used by DatabaseManager
 */
export default class Table {
  protected readonly pool: Pool;

  protected readonly name: string;

  protected readonly full: string;

  constructor(pool: Pool, name: string) {
    this.pool = pool;
    this.name = name;
    this.full = `modmail.${this.name}`;
  }

  /**
   * This is called by the constructor, if the table exists then make sure
   * it doesn't need to be migrated. Otherwise create the table
   * @returns {Promise<void>}
   */
  public async validate(): Promise<void> {
    const client = await this.getClient();
    const res = await client.query(
      'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      ['modmail', this.name],
    );
    const count = Number(res.rows[0].count);

    if (count === 0) {
      await this.init();
    } else {
      await this.migrate();
    }
  }

  protected async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Alter existing tables if needed
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected async migrate(): Promise<void> { }

  /**
   * Initialize the table if it doesn't exist
   * @returns {Promise<void>}
   */
  protected async init(): Promise<void> {
    throw new Error(`Table init for ${this.full} has not been implemented.`);
  }
}
