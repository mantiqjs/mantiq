import { ModelQueryBuilder } from './ModelQueryBuilder.ts'
import { ModelNotFoundError } from '../errors/ModelNotFoundError.ts'
import { ClosureScope, type Scope } from './Scope.ts'
import { Expression } from '../query/Expression.ts'
import type { EagerLoadSpec } from './eagerLoad.ts'
import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { PaginationResult } from '../contracts/Paginator.ts'

type CastType = 'int' | 'float' | 'boolean' | 'string' | 'json' | 'date' | 'datetime' | 'array'

/** A named scope function that receives a query builder and optional arguments. */
export type ScopeFunction<T extends Model = Model> = (query: ModelQueryBuilder<T>, ...args: any[]) => void

export interface ModelStatic<T extends Model> {
  new (): T
  connection: DatabaseConnection | null
  table: string
  primaryKey: string
  incrementing: boolean
  keyType: 'int' | 'string'
  fillable: string[]
  guarded: string[]
  hidden: string[]
  appends: string[]
  visible: string[]
  scopes: Record<string, ScopeFunction<any>>
  casts: Record<string, CastType>
  timestamps: boolean
  softDelete: boolean
  softDeleteColumn: string
  _fireEvent: ((model: Model, event: string) => Promise<boolean>) | null
  _globalScopes: Map<string, Scope>
  _booted: Set<typeof Model>
  addGlobalScope(name: string, scope: Scope | ((builder: ModelQueryBuilder<T>, model: typeof Model) => void)): void
  hasGlobalScope(name: string): boolean
  removeGlobalScope(name: string): void
  getGlobalScopes(): Map<string, Scope>
  booted(): void
  bootIfNotBooted(): void
  ensureOwnGlobalScopes(): void
  withoutEvents<R>(callback: () => Promise<R> | R): Promise<R>
  // Methods
  query(): ModelQueryBuilder<T>
  all(): Promise<T[]>
  find(id: number | string): Promise<T | null>
  findOrFail(id: number | string): Promise<T>
  where(column: string, operatorOrValue?: any, value?: any): ModelQueryBuilder<T>
  whereIn(column: string, values: any[]): ModelQueryBuilder<T>
  with(...relations: EagerLoadSpec[]): ModelQueryBuilder<T>
  first(): Promise<T | null>
  firstOrFail(): Promise<T>
  create(data: Record<string, any>): Promise<T>
  updateOrCreate(conditions: Record<string, any>, data: Record<string, any>): Promise<T>
  paginate(page?: number, perPage?: number): Promise<PaginationResult<T>>
  count(): Promise<number>
  setConnection(connection: DatabaseConnection): void
  __callStatic(method: string, ...args: any[]): ModelQueryBuilder<T> | undefined
  // Allow scope methods to exist
  [key: string]: any
}

export abstract class Model {
  // ── Static configuration (override in subclasses) ─────────────────────────

  static connection: DatabaseConnection | null = null
  static table: string = ''
  static primaryKey: string = 'id'
  static incrementing = true
  static keyType: 'int' | 'string' = 'int'
  static fillable: string[] = []
  static guarded: string[] = ['id']
  static hidden: string[] = []
  static appends: string[] = []
  static visible: string[] = []
  static scopes: Record<string, ScopeFunction<any>> = {}
  static casts: Record<string, CastType> = {}
  static timestamps = true
  static softDelete = false
  static softDeleteColumn = 'deleted_at'

  /**
   * Model event hook. Set by @mantiq/events when the events package is registered.
   * Returns false if a cancellable event was cancelled.
   */
  static _fireEvent: ((model: Model, event: string) => Promise<boolean>) | null = null

  /** Per-class global scope registry. */
  static _globalScopes = new Map<string, Scope>()

  /** Whether `booted()` has been called for this class. */
  static _booted = new Set<typeof Model>()

  // ── Instance state ────────────────────────────────────────────────────────

  protected _attributes: Record<string, any> = {}
  protected _original: Record<string, any> = {}
  protected _exists = false
  protected _relations: Record<string, any> = {}

  /** Per-instance serialization overrides */
  private _onlyFields: string[] | null = null
  private _exceptFields: string[] | null = null
  private _instanceAppends: string[] | null = null
  private _instanceVisible: string[] | null = null
  private _instanceHidden: string[] | null = null

  // ── Query API (static methods) ────────────────────────────────────────────

  static query<T extends Model>(this: ModelStatic<T>): ModelQueryBuilder<T> {
    // Ensure booted() is called once per class
    ;(this as any).bootIfNotBooted()

    const conn = this.connection
    if (!conn) throw new Error(`No connection set on model ${this.table}. Call Model.setConnection() first.`)

    const tableName = this.table || pluralize(snakeCase(this.name))
    const builder = new ModelQueryBuilder<T>(
      conn,
      tableName,
      (row) => {
        const instance = new this()
        instance.setRawAttributes(row)
        instance._exists = true
        return instance
      },
      this.softDelete ? this.softDeleteColumn : null,
    )

    // Register global scopes (applied lazily before execution)
    builder.setModel(this)
    const scopes = this.getGlobalScopes()
    for (const [name, scope] of scopes) {
      builder.registerGlobalScope(name, scope)
    }

    return builder
  }

  static async all<T extends Model>(this: ModelStatic<T>): Promise<T[]> {
    return this.query().get()
  }

  static async find<T extends Model>(this: ModelStatic<T>, id: number | string): Promise<T | null> {
    return this.query().find(id)
  }

  static async findOrFail<T extends Model>(this: ModelStatic<T>, id: number | string): Promise<T> {
    const model = await this.find(id)
    if (!model) throw new ModelNotFoundError(this.table)
    return model
  }

  static where<T extends Model>(
    this: ModelStatic<T>,
    column: string,
    operatorOrValue?: any,
    value?: any,
  ): ModelQueryBuilder<T> {
    return this.query().where(column, operatorOrValue, value) as ModelQueryBuilder<T>
  }

  static whereIn<T extends Model>(
    this: ModelStatic<T>,
    column: string,
    values: any[],
  ): ModelQueryBuilder<T> {
    return this.query().whereIn(column, values) as ModelQueryBuilder<T>
  }

  static async first<T extends Model>(this: ModelStatic<T>): Promise<T | null> {
    return this.query().first()
  }

  static async firstOrFail<T extends Model>(this: ModelStatic<T>): Promise<T> {
    return this.query().firstOrFail()
  }

  static async create<T extends Model>(this: ModelStatic<T>, data: Record<string, any>): Promise<T> {
    const instance = new this() as T
    instance.fill(data)
    await instance.save()
    return instance
  }

  static async updateOrCreate<T extends Model>(
    this: ModelStatic<T>,
    conditions: Record<string, any>,
    data: Record<string, any>,
  ): Promise<T> {
    let q = this.query()
    for (const [k, v] of Object.entries(conditions)) q = q.where(k, v) as ModelQueryBuilder<T>
    const existing = await q.first()
    if (existing) {
      existing.fill(data)
      await existing.save()
      return existing
    }
    return this.create({ ...conditions, ...data })
  }

  static async paginate<T extends Model>(
    this: ModelStatic<T>,
    page = 1,
    perPage = 15,
  ): Promise<PaginationResult<T>> {
    const result = await this.query().paginate(page, perPage)
    return result as unknown as PaginationResult<T>
  }

  static async count<T extends Model>(this: ModelStatic<T>): Promise<number> {
    return this.query().count()
  }

  static with<T extends Model>(
    this: ModelStatic<T>,
    ...relations: EagerLoadSpec[]
  ): ModelQueryBuilder<T> {
    return this.query().with(...relations)
  }

  /** Set the database connection for this model class */
  static setConnection(connection: DatabaseConnection): void {
    this.connection = connection
  }

  // ── Global Scopes ──────────────────────────────────────────────────────────

  /**
   * Register a global scope on this model.
   * Accepts a Scope instance or a closure.
   *
   * @example
   *   // Scope class
   *   User.addGlobalScope('active', new ActiveScope())
   *
   *   // Closure
   *   User.addGlobalScope('active', (builder) => builder.where('is_active', true))
   */
  static addGlobalScope(
    name: string,
    scope: Scope | ((builder: ModelQueryBuilder<any>, model: typeof Model) => void),
  ): void {
    this.ensureOwnGlobalScopes()
    if (typeof scope === 'function') {
      this._globalScopes.set(name, new ClosureScope(scope as (builder: ModelQueryBuilder<any>, model: typeof Model) => void))
    } else {
      this._globalScopes.set(name, scope)
    }
  }

  /**
   * Check if a global scope is registered.
   */
  static hasGlobalScope(name: string): boolean {
    return this._globalScopes.has(name)
  }

  /**
   * Remove a global scope from this model class.
   */
  static removeGlobalScope(name: string): void {
    this.ensureOwnGlobalScopes()
    this._globalScopes.delete(name)
  }

  /**
   * Get all registered global scopes.
   */
  static getGlobalScopes(): Map<string, Scope> {
    return this._globalScopes
  }

  /**
   * Override in subclasses to register global scopes and other boot-time config.
   * Called once per class, automatically before the first query.
   */
  static booted(): void {
    // Override in subclasses
  }

  /**
   * Ensure booted() has been called for this specific class.
   */
  static bootIfNotBooted(): void {
    if (!Model._booted.has(this)) {
      Model._booted.add(this)
      this.booted()
    }
  }

  /**
   * Ensure this class has its own scope map (copy-on-write from parent).
   */
  static ensureOwnGlobalScopes(): void {
    if (!Object.prototype.hasOwnProperty.call(this, '_globalScopes')) {
      this._globalScopes = new Map(this._globalScopes)
    }
  }

  /**
   * Scope support: calling a static method named `scope<Name>` on the class
   * allows `Model.<name>()` as a shorthand.
   * e.g., `static scopeActive(query) { ... }` → `User.active()`
   *
   * This is implemented via a static method that proxies unknown calls.
   */
  static __callStatic<T extends Model>(
    this: ModelStatic<T>,
    method: string,
    ...args: any[]
  ): ModelQueryBuilder<T> | undefined {
    const scopeName = `scope${method.charAt(0).toUpperCase() + method.slice(1)}`
    const scopeFn = (this as any)[scopeName]
    if (typeof scopeFn === 'function') {
      const query = this.query()
      scopeFn.call(this, query, ...args)
      return query
    }
    return undefined
  }

  // ── Instance methods ──────────────────────────────────────────────────────

  fill(data: Record<string, any>): this {
    const ctor = this.constructor as typeof Model
    const fillable = ctor.fillable
    const guarded = ctor.guarded

    for (const [key, value] of Object.entries(data)) {
      if (guarded.includes(key)) continue
      if (fillable.length > 0 && !fillable.includes(key)) continue
      this._attributes[key] = value
    }

    return this
  }

  forceFill(data: Record<string, any>): this {
    for (const [key, value] of Object.entries(data)) {
      this._attributes[key] = value
    }
    return this
  }

  setRawAttributes(attributes: Record<string, any>): this {
    this._attributes = { ...attributes }
    this._original = { ...attributes }
    return this
  }

  getAttribute(key: string): any {
    const ctor = this.constructor as typeof Model
    const rawValue = this._attributes[key]

    // Check for relation
    if (key in this._relations) return this._relations[key]

    // Check for custom getter (get<Key>Attribute pattern)
    // Converts snake_case to StudlyCase: full_name → getFullNameAttribute
    const getterName = `get${studlyCase(key)}Attribute` as keyof this
    if (typeof this[getterName] === 'function') {
      return (this[getterName] as any)(rawValue)
    }

    // Apply cast
    const castType = ctor.casts[key]
    if (castType) return this.castAttribute(rawValue, castType)

    return rawValue
  }

  setAttribute(key: string, value: any): this {
    const ctor = this.constructor as typeof Model

    // Check for custom setter (set<Key>Attribute pattern)
    // Converts snake_case to StudlyCase: full_name → setFullNameAttribute
    const setterName = `set${studlyCase(key)}Attribute` as keyof this
    if (typeof this[setterName] === 'function') {
      ;(this[setterName] as any)(value)
      return this
    }

    this._attributes[key] = value
    return this
  }

  get(key: string): any {
    return this.getAttribute(key)
  }

  set(key: string, value: any): this {
    return this.setAttribute(key, value)
  }

  getKey(): any {
    const ctor = this.constructor as typeof Model
    return this._attributes[ctor.primaryKey]
  }

  isDirty(key?: string): boolean {
    if (key) return this._attributes[key] !== this._original[key]
    return Object.keys(this._attributes).some((k) => this._attributes[k] !== this._original[k])
  }

  getDirty(): Record<string, any> {
    const dirty: Record<string, any> = {}
    for (const [k, v] of Object.entries(this._attributes)) {
      if (v !== this._original[k]) dirty[k] = v
    }
    return dirty
  }

  isClean(key?: string): boolean {
    return !this.isDirty(key)
  }

  wasChanged(key?: string): boolean {
    return this.isDirty(key)
  }

  // ── Serialization Control ──────────────────────────────────────────────────

  /**
   * Specify which fields to include in toObject(). Overrides visible/hidden.
   *
   * @example
   *   user.only('id', 'name').toObject()
   */
  only(...fields: string[]): this {
    this._onlyFields = fields
    return this
  }

  /**
   * Specify which fields to exclude from toObject(). Works alongside hidden.
   *
   * @example
   *   user.except('password', 'secret').toObject()
   */
  except(...fields: string[]): this {
    this._exceptFields = fields
    return this
  }

  /**
   * Add computed attributes to this instance's serialization.
   * The model must have a matching `get<Key>Attribute()` accessor.
   *
   * @example
   *   user.append('full_name').toObject()
   */
  append(...keys: string[]): this {
    this._instanceAppends = [
      ...(this._instanceAppends ?? []),
      ...keys,
    ]
    return this
  }

  /**
   * Make the given fields visible on this instance, overriding
   * the static `hidden` list for those fields.
   *
   * @example
   *   user.makeVisible('email', 'phone').toObject()
   */
  makeVisible(...fields: string[]): this {
    this._instanceVisible = [
      ...(this._instanceVisible ?? []),
      ...fields,
    ]
    return this
  }

  /**
   * Make the given fields hidden on this instance, adding to
   * the static `hidden` list for this instance.
   *
   * @example
   *   user.makeHidden('email').toObject()
   */
  makeHidden(...fields: string[]): this {
    this._instanceHidden = [
      ...(this._instanceHidden ?? []),
      ...fields,
    ]
    return this
  }

  toObject(): Record<string, any> {
    const ctor = this.constructor as typeof Model
    const obj: Record<string, any> = {}

    // Determine which fields to include
    if (this._onlyFields) {
      // only() takes absolute precedence — include only these fields
      for (const key of this._onlyFields) {
        obj[key] = this.getAttribute(key)
      }
    } else {
      // Build the effective hidden set
      const hiddenSet = new Set(ctor.hidden)

      // Instance-level makeVisible removes from hidden
      if (this._instanceVisible) {
        for (const f of this._instanceVisible) hiddenSet.delete(f)
      }

      // Instance-level makeHidden adds to hidden
      if (this._instanceHidden) {
        for (const f of this._instanceHidden) hiddenSet.add(f)
      }

      // Instance-level except() adds to hidden
      if (this._exceptFields) {
        for (const f of this._exceptFields) hiddenSet.add(f)
      }

      // If static visible is set, only include those fields
      if (ctor.visible.length > 0) {
        for (const key of ctor.visible) {
          if (hiddenSet.has(key)) continue
          if (key in this._attributes) {
            obj[key] = this.getAttribute(key)
          }
        }
      } else {
        for (const key of Object.keys(this._attributes)) {
          if (hiddenSet.has(key)) continue
          obj[key] = this.getAttribute(key)
        }
      }

      // Include loaded relations — recursively serialize Model instances
      for (const [k, v] of Object.entries(this._relations)) {
        if (hiddenSet.has(k)) continue
        if (v instanceof Model) {
          obj[k] = v.toObject()
        } else if (Array.isArray(v)) {
          obj[k] = v.map((item) => (item instanceof Model ? item.toObject() : item))
        } else {
          obj[k] = v
        }
      }
    }

    // Append computed attributes (static + instance-level)
    const appendKeys = new Set([
      ...ctor.appends,
      ...(this._instanceAppends ?? []),
    ])
    for (const key of appendKeys) {
      obj[key] = this.getAttribute(key)
    }

    return obj
  }

  toJSON(): Record<string, any> {
    return this.toObject()
  }

  [Symbol.for('nodejs.util.inspect.custom')](): Record<string, any> {
    return this.toObject()
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /**
   * Fire a model event if the events system is installed.
   * Returns false if a cancellable event was cancelled.
   */
  protected async fireModelEvent(event: string): Promise<boolean> {
    const fire = (this.constructor as typeof Model)._fireEvent
    if (!fire) return true
    return fire(this, event)
  }

  async save(): Promise<this> {
    const ctor = this.constructor as typeof Model
    if (!ctor.connection) throw new Error(`No connection set on model ${ctor.table}`)

    // saving (cancellable)
    if (await this.fireModelEvent('saving') === false) return this

    const table = ctor.table || pluralize(snakeCase(ctor.name))
    const now = new Date()

    if (this._exists) {
      const dirty = this.getDirty()
      if (Object.keys(dirty).length === 0) return this

      // updating (cancellable)
      if (await this.fireModelEvent('updating') === false) return this

      if (ctor.timestamps && 'updated_at' in this._attributes) {
        dirty['updated_at'] = now
      }

      await ctor.connection.table(table)
        .where(ctor.primaryKey, this.getKey())
        .update(dirty)

      this._original = { ...this._attributes }

      await this.fireModelEvent('updated')
    } else {
      // creating (cancellable)
      if (await this.fireModelEvent('creating') === false) return this

      if (ctor.timestamps) {
        if (!this._attributes['created_at']) this._attributes['created_at'] = now
        if (!this._attributes['updated_at']) this._attributes['updated_at'] = now
      }

      if (ctor.incrementing) {
        const id = await ctor.connection.table(table).insertGetId(this._attributes)
        this._attributes[ctor.primaryKey] = ctor.keyType === 'string' ? String(id) : Number(id)
      } else {
        // Non-incrementing (UUID) — id is already set in attributes
        await ctor.connection.table(table).insert(this._attributes)
      }
      this._original = { ...this._attributes }
      this._exists = true

      await this.fireModelEvent('created')
    }

    await this.fireModelEvent('saved')
    return this
  }

  async delete(): Promise<boolean> {
    const ctor = this.constructor as typeof Model
    if (!ctor.connection || !this._exists) return false

    // deleting (cancellable)
    if (await this.fireModelEvent('deleting') === false) return false

    const table = ctor.table || pluralize(snakeCase(ctor.name))

    if (ctor.softDelete) {
      await ctor.connection.table(table)
        .where(ctor.primaryKey, this.getKey())
        .update({ [ctor.softDeleteColumn]: new Date() })
      this._attributes[ctor.softDeleteColumn] = new Date()

      await this.fireModelEvent('trashed')
    } else {
      await ctor.connection.table(table).where(ctor.primaryKey, this.getKey()).delete()
      this._exists = false
    }

    await this.fireModelEvent('deleted')
    return true
  }

  async forceDelete(): Promise<boolean> {
    const ctor = this.constructor as typeof Model
    if (!ctor.connection || !this._exists) return false

    // forceDeleting (cancellable)
    if (await this.fireModelEvent('forceDeleting') === false) return false

    const table = ctor.table || pluralize(snakeCase(ctor.name))
    await ctor.connection.table(table).where(ctor.primaryKey, this.getKey()).delete()
    this._exists = false

    await this.fireModelEvent('forceDeleted')
    return true
  }

  async restore(): Promise<boolean> {
    const ctor = this.constructor as typeof Model
    if (!ctor.softDelete || !ctor.connection) return false

    // restoring (cancellable)
    if (await this.fireModelEvent('restoring') === false) return false

    const table = ctor.table || pluralize(snakeCase(ctor.name))
    await ctor.connection.table(table)
      .where(ctor.primaryKey, this.getKey())
      .update({ [ctor.softDeleteColumn]: null })

    this._attributes[ctor.softDeleteColumn] = null

    await this.fireModelEvent('restored')
    return true
  }

  isTrashed(): boolean {
    const ctor = this.constructor as typeof Model
    return ctor.softDelete && this._attributes[ctor.softDeleteColumn] != null
  }

  // ── Increment / Decrement ───────────────────────────────────────────────

  /**
   * Increment a column's value by the given amount.
   * Optionally update additional columns at the same time.
   *
   * @example
   *   await post.increment('views')
   *   await post.increment('votes', 5)
   *   await post.increment('votes', 1, { last_voted_at: new Date() })
   */
  async increment(column: string, amount = 1, extra: Record<string, any> = {}): Promise<this> {
    return this.incrementOrDecrement(column, amount, extra, 'increment')
  }

  /**
   * Decrement a column's value by the given amount.
   *
   * @example
   *   await post.decrement('stock')
   *   await post.decrement('balance', 50)
   */
  async decrement(column: string, amount = 1, extra: Record<string, any> = {}): Promise<this> {
    return this.incrementOrDecrement(column, amount, extra, 'decrement')
  }

  /**
   * Increment multiple columns at once.
   *
   * @example
   *   await post.incrementEach({ views: 1, shares: 2 })
   *   await post.incrementEach({ views: 1 }, { last_viewed_at: new Date() })
   */
  async incrementEach(columns: Record<string, number>, extra: Record<string, any> = {}): Promise<this> {
    const ctor = this.constructor as typeof Model
    if (!ctor.connection || !this._exists) {
      throw new Error('Cannot increment on a model that has not been persisted.')
    }

    // updating (cancellable)
    if (await this.fireModelEvent('updating') === false) return this

    const table = ctor.table || pluralize(snakeCase(ctor.name))
    const data: Record<string, any> = {}

    for (const [col, amount] of Object.entries(columns)) {
      data[col] = new Expression(`${quoteColumn(col)} + ${Number(amount)}`)
      this._attributes[col] = (Number(this._attributes[col]) || 0) + Number(amount)
    }

    Object.assign(data, extra)
    for (const [k, v] of Object.entries(extra)) {
      this._attributes[k] = v
    }

    if (ctor.timestamps && 'updated_at' in this._attributes) {
      const now = new Date()
      data['updated_at'] = now
      this._attributes['updated_at'] = now
    }

    await ctor.connection.table(table)
      .where(ctor.primaryKey, this.getKey())
      .update(data)

    this._original = { ...this._attributes }

    await this.fireModelEvent('updated')
    return this
  }

  private async incrementOrDecrement(
    column: string,
    amount: number,
    extra: Record<string, any>,
    method: 'increment' | 'decrement',
  ): Promise<this> {
    const ctor = this.constructor as typeof Model
    if (!ctor.connection || !this._exists) {
      throw new Error('Cannot increment/decrement on a model that has not been persisted.')
    }

    // updating (cancellable)
    if (await this.fireModelEvent('updating') === false) return this

    const table = ctor.table || pluralize(snakeCase(ctor.name))
    const operator = method === 'increment' ? '+' : '-'
    const data: Record<string, any> = {
      [column]: new Expression(`${quoteColumn(column)} ${operator} ${Number(amount)}`),
      ...extra,
    }

    if (ctor.timestamps && 'updated_at' in this._attributes) {
      const now = new Date()
      data['updated_at'] = now
      this._attributes['updated_at'] = now
    }

    await ctor.connection.table(table)
      .where(ctor.primaryKey, this.getKey())
      .update(data)

    // Update local state
    const delta = method === 'increment' ? Number(amount) : -Number(amount)
    this._attributes[column] = (Number(this._attributes[column]) || 0) + delta
    for (const [k, v] of Object.entries(extra)) {
      this._attributes[k] = v
    }
    this._original = { ...this._attributes }

    await this.fireModelEvent('updated')
    return this
  }

  // ── Replication ──────────────────────────────────────────────────────────

  /**
   * Create an unsaved copy of this model, optionally excluding certain attributes.
   * The clone has no primary key and _exists = false, so save() will INSERT.
   *
   * @example
   *   const copy = user.replicate()               // all fillable attributes
   *   const copy = user.replicate(['email'])       // exclude email
   */
  replicate(except?: string[]): this {
    const ctor = this.constructor as typeof Model
    const clone = new (this.constructor as any)() as this
    const excludeKeys = new Set([
      ctor.primaryKey,
      ...(ctor.timestamps ? ['created_at', 'updated_at'] : []),
      ...(ctor.softDelete ? [ctor.softDeleteColumn] : []),
      ...(except ?? []),
    ])

    for (const [key, value] of Object.entries(this._attributes)) {
      if (!excludeKeys.has(key)) {
        clone._attributes[key] = value
      }
    }

    return clone
  }

  // ── Event control ────────────────────────────────────────────────────────

  /**
   * Execute a callback with model events disabled for this model class.
   *
   * @example
   *   await User.withoutEvents(async () => {
   *     await User.create({ name: 'Seed User' })
   *   })
   */
  static async withoutEvents<R>(callback: () => Promise<R> | R): Promise<R> {
    const previous = this._fireEvent
    this._fireEvent = null
    try {
      return await callback()
    } finally {
      this._fireEvent = previous
    }
  }

  // ── Relations ─────────────────────────────────────────────────────────────

  protected hasOne<R extends Model>(
    related: ModelStatic<R>,
    foreignKey?: string,
    localKey?: string,
  ) {
    const ctor = this.constructor as typeof Model
    const fk = foreignKey ?? `${snakeCase(ctor.name)}_id`
    const lk = localKey ?? ctor.primaryKey
    return new HasOneRelation<R>(related, this._attributes[lk], fk)
  }

  protected hasMany<R extends Model>(
    related: ModelStatic<R>,
    foreignKey?: string,
    localKey?: string,
  ) {
    const ctor = this.constructor as typeof Model
    const fk = foreignKey ?? `${snakeCase(ctor.name)}_id`
    const lk = localKey ?? ctor.primaryKey
    return new HasManyRelation<R>(related, this._attributes[lk], fk)
  }

  protected belongsTo<R extends Model>(
    related: ModelStatic<R>,
    foreignKey?: string,
    ownerKey?: string,
  ) {
    const relatedCtor = related as typeof Model
    const fk = foreignKey ?? `${snakeCase(relatedCtor.name)}_id`
    const ok = ownerKey ?? relatedCtor.primaryKey
    return new BelongsToRelation<R>(related, this._attributes[fk], ok)
  }

  protected belongsToMany<R extends Model>(
    related: ModelStatic<R>,
    pivotTable?: string,
    foreignKey?: string,
    relatedKey?: string,
  ) {
    const ctor = this.constructor as typeof Model
    const relatedCtor = related as typeof Model
    const pivot = pivotTable ?? [snakeCase(ctor.name), snakeCase(relatedCtor.name)].sort().join('_')
    const fk = foreignKey ?? `${snakeCase(ctor.name)}_id`
    const rk = relatedKey ?? `${snakeCase(relatedCtor.name)}_id`
    return new BelongsToManyRelation<R>(related, this._attributes[ctor.primaryKey], pivot, fk, rk)
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private castAttribute(value: any, type: CastType): any {
    if (value === null || value === undefined) return value
    switch (type) {
      case 'int': return parseInt(value, 10)
      case 'float': return parseFloat(value)
      case 'boolean': return Boolean(value) && value !== '0' && value !== 0
      case 'string': return String(value)
      case 'json':
      case 'array':
        if (typeof value === 'string') {
          try { return JSON.parse(value) } catch { return value }
        }
        return value
      case 'date': return new Date(value)
      case 'datetime': return new Date(value)
      default: return value
    }
  }
}

// ── Relation classes ──────────────────────────────────────────────────────────

export class HasOneRelation<T extends Model> {
  constructor(
    private readonly related: ModelStatic<T>,
    private readonly parentId: any,
    private readonly foreignKey: string,
  ) {}

  async get(): Promise<T | null> {
    return this.related.where(this.foreignKey, this.parentId).first()
  }

  async getOrFail(): Promise<T> {
    const result = await this.get()
    if (!result) throw new ModelNotFoundError((this.related as typeof Model).table)
    return result
  }
}

export class HasManyRelation<T extends Model> {
  constructor(
    private readonly related: ModelStatic<T>,
    private readonly parentId: any,
    private readonly foreignKey: string,
  ) {}

  query(): ModelQueryBuilder<T> {
    return this.related.where(this.foreignKey, this.parentId)
  }

  async get(): Promise<T[]> {
    return this.query().get()
  }

  async create(data: Record<string, any>): Promise<T> {
    return this.related.create({ ...data, [this.foreignKey]: this.parentId })
  }
}

export class BelongsToRelation<T extends Model> {
  constructor(
    private readonly related: ModelStatic<T>,
    private readonly foreignId: any,
    private readonly ownerKey: string,
  ) {}

  async get(): Promise<T | null> {
    if (this.foreignId == null) return null
    return this.related.where(this.ownerKey, this.foreignId).first()
  }

  async getOrFail(): Promise<T> {
    const result = await this.get()
    if (!result) throw new ModelNotFoundError((this.related as typeof Model).table)
    return result
  }
}

export class BelongsToManyRelation<T extends Model> {
  constructor(
    private readonly related: ModelStatic<T>,
    private readonly parentId: any,
    private readonly pivotTable: string,
    private readonly foreignKey: string,
    private readonly relatedKey: string,
  ) {}

  async get(): Promise<T[]> {
    const ctor = this.related as typeof Model
    if (!ctor.connection) return []

    const pivotRows = await ctor.connection.table(this.pivotTable)
      .where(this.foreignKey, this.parentId)
      .pluck(this.relatedKey)

    if (!pivotRows.length) return []
    return this.related.whereIn(ctor.primaryKey, pivotRows).get()
  }

  async attach(ids: any[]): Promise<void> {
    const ctor = this.related as typeof Model
    if (!ctor.connection) return
    for (const id of ids) {
      await ctor.connection.table(this.pivotTable).insert({
        [this.foreignKey]: this.parentId,
        [this.relatedKey]: id,
      })
    }
  }

  async detach(ids?: any[]): Promise<void> {
    const ctor = this.related as typeof Model
    if (!ctor.connection) return
    let q = ctor.connection.table(this.pivotTable).where(this.foreignKey, this.parentId)
    if (ids) q = q.whereIn(this.relatedKey, ids)
    await q.delete()
  }

  async sync(ids: any[]): Promise<void> {
    await this.detach()
    await this.attach(ids)
  }
}

// ── Utility ────────────────────────────────────────────────────────────────────

function snakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}

/** Quote a column name with double quotes for use in raw expressions. */
function quoteColumn(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** Convert a snake_case or camelCase key to StudlyCase for accessor lookup. */
function studlyCase(key: string): string {
  return key
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/** Simple English pluralization for table name derivation. */
function pluralize(word: string): string {
  if (word.endsWith('ss') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) return word + 'es'
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies'
  if (word.endsWith('fe')) return word.slice(0, -2) + 'ves'
  if (word.endsWith('f')) return word.slice(0, -1) + 'ves'
  if (word.endsWith('s')) return word
  return word + 's'
}
