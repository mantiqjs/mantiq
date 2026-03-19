import { Event } from '@mantiq/core'

/**
 * Fired after a database query is executed.
 * Useful for query logging, debugging, and performance monitoring.
 */
export class QueryExecuted extends Event {
  constructor(
    /** The SQL query string. */
    public readonly sql: string,
    /** The query bindings. */
    public readonly bindings: any[],
    /** Time in milliseconds the query took to execute. */
    public readonly time: number,
    /** The connection name (e.g. 'sqlite'). */
    public readonly connectionName: string,
  ) {
    super()
  }
}

/**
 * Fired when a database transaction begins.
 */
export class TransactionBeginning extends Event {
  constructor(public readonly connectionName: string) {
    super()
  }
}

/**
 * Fired when a database transaction is committed.
 */
export class TransactionCommitted extends Event {
  constructor(public readonly connectionName: string) {
    super()
  }
}

/**
 * Fired when a database transaction is rolled back.
 */
export class TransactionRolledBack extends Event {
  constructor(public readonly connectionName: string) {
    super()
  }
}

// ── Migration Events ─────────────────────────────────────────────────────────

/**
 * Fired before a single migration is executed (up or down).
 */
export class MigrationStarted extends Event {
  constructor(
    /** The migration name (e.g. '2024_01_01_create_users_table'). */
    public readonly migration: string,
    /** 'up' for running, 'down' for rolling back. */
    public readonly method: 'up' | 'down',
  ) {
    super()
  }
}

/**
 * Fired after a single migration has been executed (up or down).
 */
export class MigrationEnded extends Event {
  constructor(
    /** The migration name. */
    public readonly migration: string,
    /** 'up' for running, 'down' for rolling back. */
    public readonly method: 'up' | 'down',
  ) {
    super()
  }
}

/**
 * Fired before a batch of migrations starts (run/rollback/reset).
 */
export class MigrationsStarted extends Event {
  constructor(
    /** 'up' for running, 'down' for rolling back. */
    public readonly method: 'up' | 'down',
  ) {
    super()
  }
}

/**
 * Fired after a batch of migrations finishes (run/rollback/reset).
 */
export class MigrationsEnded extends Event {
  constructor(
    /** 'up' for running, 'down' for rolling back. */
    public readonly method: 'up' | 'down',
  ) {
    super()
  }
}
