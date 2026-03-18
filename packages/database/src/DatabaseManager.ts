import type { DatabaseConnection } from './contracts/Connection.ts'
import type { MongoDatabaseConnection } from './contracts/MongoConnection.ts'
import { SQLiteConnection } from './drivers/SQLiteConnection.ts'
import { PostgresConnection } from './drivers/PostgresConnection.ts'
import { MySQLConnection } from './drivers/MySQLConnection.ts'
import { MongoConnection } from './drivers/MongoConnection.ts'
import { ConnectionError } from './errors/ConnectionError.ts'

export interface SQLConfig {
  driver: 'sqlite' | 'postgres' | 'mysql'
  database: string
  host?: string
  port?: number
  user?: string
  password?: string
  ssl?: boolean
  pool?: { min?: number; max?: number }
}

export interface MongoConfig {
  driver: 'mongodb'
  uri: string
  database: string
  options?: Record<string, any>
}

export type ConnectionConfig = SQLConfig | MongoConfig

export interface DatabaseConfig {
  default?: string
  connections: Record<string, ConnectionConfig>
}

export class DatabaseManager {
  private sqlConnections = new Map<string, DatabaseConnection>()
  private mongoConnections = new Map<string, MongoDatabaseConnection>()

  constructor(private readonly config: DatabaseConfig) {}

  /** Get a SQL DatabaseConnection by name */
  connection(name?: string): DatabaseConnection {
    const connName = name ?? this.config.default ?? 'default'
    if (this.sqlConnections.has(connName)) return this.sqlConnections.get(connName)!

    const cfg = this.config.connections[connName]
    if (!cfg) throw new ConnectionError(`Connection "${connName}" not configured`, connName)

    const conn = this.makeConnection(cfg)
    this.sqlConnections.set(connName, conn)
    return conn
  }

  /** Get a MongoDB connection by name */
  mongo(name?: string): MongoDatabaseConnection {
    const connName = name ?? this.config.default ?? 'default'
    if (this.mongoConnections.has(connName)) return this.mongoConnections.get(connName)!

    const cfg = this.config.connections[connName]
    if (!cfg) throw new ConnectionError(`Connection "${connName}" not configured`, connName)

    if (cfg.driver !== 'mongodb') {
      throw new ConnectionError(`Connection "${connName}" is not a MongoDB connection`, connName)
    }

    const conn = new MongoConnection({ uri: cfg.uri, database: cfg.database, options: cfg.options })
    this.mongoConnections.set(connName, conn)
    return conn
  }

  /** Shorthand for the default SQL connection's table() method */
  table(name: string) {
    return this.connection().table(name)
  }

  /** Shorthand for the default SQL connection's schema() method */
  schema() {
    return this.connection().schema()
  }

  /** Shorthand for MongoDB collection */
  collection(name: string) {
    return this.mongo().collection(name)
  }

  private makeConnection(cfg: ConnectionConfig): DatabaseConnection {
    switch (cfg.driver) {
      case 'sqlite':
        return new SQLiteConnection({ database: cfg.database })
      case 'postgres':
        return new PostgresConnection({
          database: cfg.database,
          host: cfg.host,
          port: cfg.port,
          user: cfg.user,
          password: cfg.password,
          ssl: cfg.ssl,
          pool: cfg.pool,
        })
      case 'mysql':
        return new MySQLConnection({
          database: cfg.database,
          host: cfg.host,
          port: cfg.port,
          user: cfg.user,
          password: cfg.password,
          pool: cfg.pool,
        })
      case 'mongodb':
        // MongoDB is handled separately via mongo()
        throw new ConnectionError(`Use .mongo() to access MongoDB connections`, cfg.driver)
      default:
        throw new ConnectionError(`Unknown driver "${(cfg as any).driver}"`, (cfg as any).driver)
    }
  }
}
