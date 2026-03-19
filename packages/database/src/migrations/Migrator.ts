import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { MigrationContract } from './Migration.ts'
import type { EventDispatcher } from '@mantiq/core'
import { MigrationRepository } from './MigrationRepository.ts'
import { MigrationStarted, MigrationEnded, MigrationsStarted, MigrationsEnded } from '../events/DatabaseEvents.ts'
import { join } from 'node:path'

export interface MigrationFile {
  name: string
  migration: MigrationContract
}

export interface MigratorOptions {
  /** Directory containing migration files. Each file must default-export a Migration class. */
  migrationsPath?: string
}

export class Migrator {
  private repo: MigrationRepository

  /** Optional event dispatcher. Set by @mantiq/events when installed. */
  static _dispatcher: EventDispatcher | null = null

  constructor(
    private readonly connection: DatabaseConnection,
    private readonly options: MigratorOptions = {},
  ) {
    this.repo = new MigrationRepository(connection)
  }

  async run(migrations?: MigrationFile[]): Promise<string[]> {
    await this.repo.createTable()

    const files = migrations ?? (await this.loadFromDirectory())
    const ran = await this.repo.getRan()
    const pending = files.filter((f) => !ran.includes(f.name))

    if (!pending.length) return []

    const batch = (await this.repo.getLastBatch()) + 1
    const ran_: string[] = []

    await Migrator._dispatcher?.emit(new MigrationsStarted('up'))

    for (const file of pending) {
      await Migrator._dispatcher?.emit(new MigrationStarted(file.name, 'up'))
      const schema = this.connection.schema()
      await file.migration.up(schema, this.connection)
      await this.repo.log(file.name, batch)
      ran_.push(file.name)
      await Migrator._dispatcher?.emit(new MigrationEnded(file.name, 'up'))
    }

    await Migrator._dispatcher?.emit(new MigrationsEnded('up'))

    return ran_
  }

  async rollback(migrations?: MigrationFile[]): Promise<string[]> {
    await this.repo.createTable()

    const lastBatch = await this.repo.getLastBatchMigrations()
    if (!lastBatch.length) return []

    // Build lookup map
    const files = migrations ?? (await this.loadFromDirectory())
    const lookup = new Map(files.map((f) => [f.name, f]))

    const rolled: string[] = []

    await Migrator._dispatcher?.emit(new MigrationsStarted('down'))

    for (const name of lastBatch) {
      const file = lookup.get(name)
      if (!file) continue
      await Migrator._dispatcher?.emit(new MigrationStarted(name, 'down'))
      const schema = this.connection.schema()
      await file.migration.down(schema, this.connection)
      await this.repo.delete(name)
      rolled.push(name)
      await Migrator._dispatcher?.emit(new MigrationEnded(name, 'down'))
    }

    await Migrator._dispatcher?.emit(new MigrationsEnded('down'))

    return rolled
  }

  async reset(migrations?: MigrationFile[]): Promise<string[]> {
    await this.repo.createTable()

    const ran = await this.repo.getRan()
    const files = migrations ?? (await this.loadFromDirectory())
    const lookup = new Map(files.map((f) => [f.name, f]))

    // Run in reverse order
    const reversed = [...ran].reverse()
    const rolled: string[] = []

    await Migrator._dispatcher?.emit(new MigrationsStarted('down'))

    for (const name of reversed) {
      const file = lookup.get(name)
      if (!file) continue
      await Migrator._dispatcher?.emit(new MigrationStarted(name, 'down'))
      const schema = this.connection.schema()
      await file.migration.down(schema, this.connection)
      await this.repo.delete(name)
      rolled.push(name)
      await Migrator._dispatcher?.emit(new MigrationEnded(name, 'down'))
    }

    await Migrator._dispatcher?.emit(new MigrationsEnded('down'))

    return rolled
  }

  /**
   * Drop all tables and re-run all migrations from scratch.
   */
  async fresh(migrations?: MigrationFile[]): Promise<string[]> {
    const schema = this.connection.schema()

    // Disable FK constraints so tables can be dropped in any order
    await schema.disableForeignKeyConstraints()

    try {
      const tables = await this.getAllTables()
      for (const table of tables) {
        await schema.dropIfExists(table)
      }
    } finally {
      await schema.enableForeignKeyConstraints()
    }

    // Re-run all migrations
    return this.run(migrations)
  }

  private async getAllTables(): Promise<string[]> {
    const driver = this.connection.getDriverName()
    let rows: Record<string, any>[]

    if (driver === 'sqlite') {
      rows = await this.connection.select(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      return rows.map((r) => r['name'] as string)
    } else if (driver === 'postgres') {
      rows = await this.connection.select(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      )
      return rows.map((r) => r['tablename'] as string)
    } else if (driver === 'mssql') {
      rows = await this.connection.select(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'",
      )
      return rows.map((r) => r['TABLE_NAME'] as string)
    } else {
      // MySQL
      rows = await this.connection.select('SHOW TABLES')
      return rows.map((r) => Object.values(r)[0] as string)
    }
  }

  async status(): Promise<Array<{ name: string; ran: boolean; batch: number | null }>> {
    await this.repo.createTable()

    const files = await this.loadFromDirectory()
    const ran = await this.repo.getRan()
    const rows = await this.connection.table('migrations').get()
    const batchMap = new Map(rows.map((r) => [r['migration'] as string, r['batch'] as number]))

    return files.map((f) => ({
      name: f.name,
      ran: ran.includes(f.name),
      batch: batchMap.get(f.name) ?? null,
    }))
  }

  private async loadFromDirectory(): Promise<MigrationFile[]> {
    if (!this.options.migrationsPath) return []

    const glob = new Bun.Glob('*.ts')
    const files: MigrationFile[] = []

    for await (const file of glob.scan(this.options.migrationsPath)) {
      const name = file.replace(/\.ts$/, '')
      const path = join(this.options.migrationsPath, file)
      const mod = await import(path)
      const MigrationClass = mod.default
      if (MigrationClass) {
        files.push({ name, migration: new MigrationClass() })
      }
    }

    // Sort by filename (timestamp prefix ensures correct order)
    files.sort((a, b) => a.name.localeCompare(b.name))
    return files
  }
}
