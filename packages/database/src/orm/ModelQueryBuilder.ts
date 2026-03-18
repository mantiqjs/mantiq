import { QueryBuilder } from '../query/Builder.ts'
import { ModelNotFoundError } from '../errors/ModelNotFoundError.ts'
import { eagerLoadRelations, type EagerLoadSpec, normalizeEagerLoads } from './eagerLoad.ts'
import type { Model } from './Model.ts'
import type { DatabaseConnection } from '../contracts/Connection.ts'

export class ModelQueryBuilder<T> extends QueryBuilder {
  private _eagerLoads: string[] = []
  private _eagerConstraints = new Map<string, ((query: ModelQueryBuilder<any>) => void) | null>()

  constructor(
    connection: DatabaseConnection,
    table: string,
    private readonly _hydrate: (row: Record<string, any>) => T,
    private readonly softDeleteColumn: string | null = null,
    private _withTrashed = false,
  ) {
    super(connection, table)
    if (softDeleteColumn && !_withTrashed) {
      this.whereNull(softDeleteColumn)
    }
  }

  // ── Eager Loading ───────────────────────────────────────────────────────

  /**
   * Specify relations to eager-load.
   *
   * @example
   *   User.query().with('posts', 'profile').get()
   *   User.query().with('posts.comments').get()
   *   User.query().with({ posts: q => q.where('published', true) }).get()
   */
  with(...specs: EagerLoadSpec[]): this {
    const normalized = normalizeEagerLoads(...specs)
    for (const [name, constraint] of normalized) {
      if (!this._eagerLoads.includes(name)) {
        this._eagerLoads.push(name)
      }
      if (constraint) {
        this._eagerConstraints.set(name, constraint)
      }
    }

    // Also track full dot-notation specs for nested loading
    for (const spec of specs) {
      if (typeof spec === 'string' && spec.includes('.')) {
        if (!this._eagerLoads.includes(spec)) {
          this._eagerLoads.push(spec)
        }
      }
    }

    return this
  }

  withTrashed(): this {
    this._withTrashed = true
    this.state.wheres = this.state.wheres.filter(
      (w) => !(w.type === 'null' && w.column === this.softDeleteColumn),
    )
    return this
  }

  onlyTrashed(): this {
    this._withTrashed = true
    this.state.wheres = this.state.wheres.filter(
      (w) => !(w.type === 'null' && w.column === this.softDeleteColumn),
    )
    if (this.softDeleteColumn) {
      this.whereNotNull(this.softDeleteColumn)
    }
    return this
  }

  // ── Hydrating read methods ─────────────────────────────────────────────────

  override async get(): Promise<T[]> {
    const rows = await this.raw().get()
    const models = rows.map(this._hydrate)

    // Eager-load relations if any were requested
    if (this._eagerLoads.length > 0 && models.length > 0) {
      await eagerLoadRelations(
        models as unknown as Model[],
        this._eagerLoads,
        this._eagerConstraints,
      )
    }

    return models
  }

  override async first(): Promise<T | null> {
    const row = await this.raw().first()
    if (!row) return null

    const model = this._hydrate(row)

    if (this._eagerLoads.length > 0) {
      await eagerLoadRelations(
        [model as unknown as Model],
        this._eagerLoads,
        this._eagerConstraints,
      )
    }

    return model
  }

  async firstOrFail(): Promise<T> {
    const result = await this.first()
    if (!result) throw new ModelNotFoundError(this.state.table)
    return result
  }

  override async find(id: number | string): Promise<T | null> {
    const row = await this.raw().where('id', id).first()
    if (!row) return null

    const model = this._hydrate(row)

    if (this._eagerLoads.length > 0) {
      await eagerLoadRelations(
        [model as unknown as Model],
        this._eagerLoads,
        this._eagerConstraints,
      )
    }

    return model
  }

  async findOrFail(id: number | string): Promise<T> {
    const result = await this.find(id)
    if (!result) throw new ModelNotFoundError(this.state.table)
    return result
  }

  // ── Aggregates: delegate to raw QB to bypass hydration ────────────────────

  override async count(column = '*'): Promise<number> {
    return this.raw().count(column)
  }

  override async sum(column: string): Promise<number> {
    return this.raw().sum(column)
  }

  override async avg(column: string): Promise<number> {
    return this.raw().avg(column)
  }

  override async min(column: string): Promise<any> {
    return this.raw().min(column)
  }

  override async max(column: string): Promise<any> {
    return this.raw().max(column)
  }

  override async exists(): Promise<boolean> {
    return this.raw().exists()
  }

  override async doesntExist(): Promise<boolean> {
    return this.raw().doesntExist()
  }

  override async value(column: string): Promise<any> {
    return this.raw().value(column)
  }

  override async pluck(column: string): Promise<any[]> {
    return this.raw().pluck(column)
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Snapshot current state into a plain QueryBuilder (no hydration) */
  private raw(): QueryBuilder {
    const q = new QueryBuilder(this._connection, this.state.table)
    q['state'] = {
      table: this.state.table,
      columns: [...this.state.columns],
      distinct: this.state.distinct,
      wheres: [...this.state.wheres],
      joins: [...this.state.joins],
      orders: [...this.state.orders],
      groups: [...this.state.groups],
      havings: [...this.state.havings],
      limitValue: this.state.limitValue,
      offsetValue: this.state.offsetValue,
    }
    return q
  }
}
