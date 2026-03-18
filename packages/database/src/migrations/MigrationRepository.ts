import type { DatabaseConnection } from '../contracts/Connection.ts'

export class MigrationRepository {
  private readonly table = 'migrations'

  constructor(private readonly connection: DatabaseConnection) {}

  async createTable(): Promise<void> {
    const exists = await this.connection.schema().hasTable(this.table)
    if (!exists) {
      await this.connection.schema().create(this.table, (t) => {
        t.id()
        t.string('migration', 255)
        t.integer('batch')
        t.timestamp('run_at').nullable()
      })
    }
  }

  async getRan(): Promise<string[]> {
    const rows = await this.connection.table(this.table).pluck('migration')
    return rows as string[]
  }

  async getLastBatch(): Promise<number> {
    const result = await this.connection.table(this.table).max('batch')
    return Number(result ?? 0)
  }

  async log(migration: string, batch: number): Promise<void> {
    await this.connection.table(this.table).insert({
      migration,
      batch,
      run_at: new Date(),
    })
  }

  async delete(migration: string): Promise<void> {
    await this.connection.table(this.table).where('migration', migration).delete()
  }

  async getLastBatchMigrations(): Promise<string[]> {
    const batch = await this.getLastBatch()
    if (batch === 0) return []
    return this.connection.table(this.table)
      .where('batch', batch)
      .orderBy('id', 'desc')
      .pluck('migration') as Promise<string[]>
  }
}
