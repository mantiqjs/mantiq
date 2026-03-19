import type { Model, ModelStatic } from '../orm/Model.ts'
import { Faker } from './Faker.ts'

type DefinitionFn<T> = (index: number, fake: Faker) => Record<string, any>
type AfterCreateFn<T extends Model> = (model: T) => Promise<void>

export interface BulkCreateOptions {
  /** Rows per INSERT statement (default 500) */
  batchSize?: number
  /** Called after each batch with rows inserted so far */
  onProgress?: (inserted: number, total: number) => void
}

/**
 * Model factory for generating test data.
 *
 * Immutable — state(), count(), and afterCreate() return a new instance,
 * so chaining never pollutes the original factory.
 *
 * @example
 * class UserFactory extends Factory<User> {
 *   protected model = User
 *   definition(index: number, fake: Faker) {
 *     return {
 *       name: fake.name(),
 *       email: fake.email(),
 *       role: fake.pick(['admin', 'user']),
 *     }
 *   }
 * }
 *
 * const factory = new UserFactory()
 * const user  = await factory.create()
 * const users = await factory.count(5).create()
 * const admin = await factory.state({ role: 'admin' }).create()
 */
export abstract class Factory<T extends Model> {
  protected abstract model: ModelStatic<T>
  protected _count = 1
  protected _states: DefinitionFn<T>[] = []
  protected _afterCreate: AfterCreateFn<T>[] = []
  protected _sequence = 0

  /** Shared faker instance — override or seed in subclass if needed */
  protected fake = new Faker()

  abstract definition(index: number, fake: Faker): Record<string, any>

  /** Clone this factory with shallow-copied mutable arrays */
  protected clone(): this {
    const copy = Object.create(Object.getPrototypeOf(this)) as this
    Object.assign(copy, this)
    copy._states = [...this._states]
    copy._afterCreate = [...this._afterCreate]
    return copy
  }

  count(n: number): this {
    const copy = this.clone()
    copy._count = n
    return copy
  }

  state(overrides: Partial<Record<string, any>> | DefinitionFn<T>): this {
    const copy = this.clone()
    if (typeof overrides === 'function') {
      copy._states.push(overrides as DefinitionFn<T>)
    } else {
      copy._states.push(() => overrides)
    }
    return copy
  }

  afterCreate(fn: AfterCreateFn<T>): this {
    const copy = this.clone()
    copy._afterCreate.push(fn)
    return copy
  }

  /** Make model instances (not persisted) */
  make(overrides?: Record<string, any>): T | T[] {
    const results: T[] = []
    for (let i = 0; i < this._count; i++) {
      const index = ++this._sequence
      const attrs = this.resolveAttributes(index, overrides)
      const instance = new (this.model as any)()
      instance.forceFill(attrs)
      results.push(instance)
    }
    return this._count === 1 ? results[0]! : results
  }

  /** Create and persist model instances */
  async create(overrides?: Record<string, any>): Promise<T | T[]> {
    const results: T[] = []
    for (let i = 0; i < this._count; i++) {
      const index = ++this._sequence
      const attrs = this.resolveAttributes(index, overrides)
      const model = await this.model.create(attrs)
      for (const fn of this._afterCreate) await fn(model)
      results.push(model)
    }
    return this._count === 1 ? results[0]! : results
  }

  /** Create and return raw attribute objects (not persisted) */
  raw(overrides?: Record<string, any>): Record<string, any> | Record<string, any>[] {
    const results: Record<string, any>[] = []
    for (let i = 0; i < this._count; i++) {
      const index = ++this._sequence
      results.push(this.resolveAttributes(index, overrides))
    }
    return this._count === 1 ? results[0]! : results
  }

  /**
   * Bulk-insert rows using multi-value INSERT statements in a transaction.
   * Generates attributes in streaming batches to stay memory-friendly.
   * Returns the total number of rows inserted.
   *
   * @example
   * await new UserFactory().count(1_000_000).createBulk(db(), {
   *   batchSize: 1000,
   *   onProgress: (done, total) => console.log(`${done}/${total}`),
   * })
   */
  async createBulk(
    connection: { statement(sql: string, bindings?: any[]): Promise<number>; transaction<R>(fn: (c: any) => Promise<R>): Promise<R> },
    options?: BulkCreateOptions,
  ): Promise<number> {
    const batchSize = options?.batchSize ?? 500
    const total = this._count
    const tableName = (this.model as any).table as string
    let inserted = 0

    await connection.transaction(async (conn: any) => {
      while (inserted < total) {
        const chunkSize = Math.min(batchSize, total - inserted)
        const rows: Record<string, any>[] = []

        for (let i = 0; i < chunkSize; i++) {
          const index = ++this._sequence
          rows.push(this.resolveAttributes(index))
        }

        const columns = Object.keys(rows[0]!)
        const quotedCols = columns.map((c) => `"${c}"`).join(', ')
        const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`
        const allPlaceholders = Array.from({ length: chunkSize }, () => rowPlaceholder).join(', ')
        const bindings = rows.flatMap((r) => columns.map((c) => r[c]))
        const sql = `INSERT INTO "${tableName}" (${quotedCols}) VALUES ${allPlaceholders}`

        await conn.statement(sql, bindings)
        inserted += chunkSize
        options?.onProgress?.(inserted, total)
      }
    })

    return inserted
  }

  private resolveAttributes(index: number, overrides?: Record<string, any>): Record<string, any> {
    let attrs = this.definition(index, this.fake)
    for (const stateFn of this._states) {
      attrs = { ...attrs, ...stateFn(index, this.fake) }
    }
    if (overrides) attrs = { ...attrs, ...overrides }
    return attrs
  }
}
