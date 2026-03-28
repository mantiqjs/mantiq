import type { DatabaseConnection } from './contracts/Connection.ts'
import { SQLiteConnection } from './drivers/SQLiteConnection.ts'
import { PostgresConnection } from './drivers/PostgresConnection.ts'
import { MySQLConnection } from './drivers/MySQLConnection.ts'
import { MSSQLConnection } from './drivers/MSSQLConnection.ts'
import { MongoConnection } from './drivers/MongoConnection.ts'
import { ConnectionError } from './errors/ConnectionError.ts'

export interface SQLConfig {
  driver: 'sqlite' | 'postgres' | 'mysql' | 'mssql'
  database: string
  host?: string | undefined
  port?: number | undefined
  user?: string | undefined
  password?: string | undefined
  ssl?: boolean | undefined
  encrypt?: boolean | undefined
  trustServerCertificate?: boolean | undefined
  pool?: { min?: number | undefined; max?: number | undefined } | undefined
}

export interface MongoConfig {
  driver: 'mongodb'
  uri: string
  database: string
  options?: Record<string, any> | undefined
}

export type ConnectionConfig = SQLConfig | MongoConfig

export interface DatabaseConfig {
  default?: string | undefined
  connections: Record<string, ConnectionConfig>
  /** Threshold in ms above which a query is considered slow. Set to 0 or null to disable. */
  slowQueryThreshold?: number | null | undefined
}

// ── Query Log ─────────────────────────────────────────────────────────────────

export interface QueryLogEntry {
  sql: string
  bindings: any[]
  duration: number
  connection: string
  timestamp: Date
}

export class DatabaseManager {
  private sqlConnections = new Map<string, DatabaseConnection>()
  private mongoConnections = new Map<string, MongoConnection>()

  // ── Query logging state ─────────────────────────────────────────────────
  private _queryLog: QueryLogEntry[] = []
  private _loggingEnabled = false
  private _slowQueryThreshold: number | null

  constructor(private readonly config: DatabaseConfig) {
    this._slowQueryThreshold = config.slowQueryThreshold ?? null
  }

  // ── Query Logging API ───────────────────────────────────────────────────

  /** Enable query logging. All subsequent queries will be recorded. */
  enableQueryLog(): void {
    this._loggingEnabled = true
  }

  /** Disable query logging. Existing log entries are preserved. */
  disableQueryLog(): void {
    this._loggingEnabled = false
  }

  /** Returns all recorded query log entries. */
  getQueryLog(): QueryLogEntry[] {
    return [...this._queryLog]
  }

  /** Clear all recorded query log entries. */
  flushQueryLog(): void {
    this._queryLog = []
  }

  /**
   * Record a query in the log (if logging is enabled) and check for slow queries.
   * This is called by connection drivers after executing a query.
   */
  logQuery(sql: string, bindings: any[], duration: number, connection: string): void {
    if (this._loggingEnabled) {
      this._queryLog.push({ sql, bindings, duration, connection, timestamp: new Date() })
    }

    if (this._slowQueryThreshold != null && this._slowQueryThreshold > 0 && duration > this._slowQueryThreshold) {
      console.warn(
        `[mantiq/database] Slow query detected (${duration.toFixed(1)}ms > ${this._slowQueryThreshold}ms) on connection "${connection}": ${sql}`,
      )
    }
  }

  /** Get or set the slow query threshold (in ms). Pass null to disable. */
  slowQueryThreshold(value?: number | null): number | null {
    if (value !== undefined) {
      this._slowQueryThreshold = value
    }
    return this._slowQueryThreshold
  }

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
  mongo(name?: string): MongoConnection {
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
      case 'mssql':
        return new MSSQLConnection(cfg as any)
      case 'mongodb':
        // MongoDB is handled separately via mongo()
        throw new ConnectionError(`Use .mongo() to access MongoDB connections`, cfg.driver)
      default:
        throw new ConnectionError(`Unknown driver "${(cfg as any).driver}"`, (cfg as any).driver)
    }
  }
}
