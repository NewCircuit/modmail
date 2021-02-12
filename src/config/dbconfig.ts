import Conf from './conf';

/**
 * The "database" section of the config.yml
 * @class DBConfig
 * @property {string} host
 * @property {number} port
 * @property {string} username
 * @property {string} password
 * @property {string} schema
 * @property {string} database
 */
export default class DBConfig extends Conf {
  public readonly host: string;

  public readonly port: number;

  public readonly user: string;

  public readonly password: string;

  public readonly database: string;

  public readonly schema: string;

  constructor() {
    super('database');
    this.host = 'localhost';
    this.port = 5432;
    this.user = 'modmail';
    this.password = '1234';
    this.database = 'postgres';
    this.schema = 'modmail';
  }
}
