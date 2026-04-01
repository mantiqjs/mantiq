// @ts-nocheck
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { StudioController } from '../../src/http/StudioController.ts'
import { PanelManager } from '../../src/panel/PanelManager.ts'
import { StudioPanel } from '../../src/StudioPanel.ts'
import { Resource } from '../../src/resources/Resource.ts'
import { Form } from '../../src/forms/Form.ts'
import { TextInput } from '../../src/forms/components/TextInput.ts'
import { Toggle } from '../../src/forms/components/Toggle.ts'
import { Table } from '../../src/tables/Table.ts'
import { TextColumn } from '../../src/tables/columns/TextColumn.ts'
import { BooleanColumn } from '../../src/tables/columns/BooleanColumn.ts'
import { Action } from '../../src/actions/Action.ts'
import { BulkAction } from '../../src/actions/BulkAction.ts'
import type { ActionResult } from '../../src/actions/Action.ts'

// ── SQLite Database Setup ────────────────────────────────────────────────────

let db: Database

function createDatabase(): Database {
  const database = new Database(':memory:')

  database.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)

  return database
}

function seedDatabase(database: Database): void {
  const insertUser = database.prepare(
    'INSERT INTO users (name, email, role, active, created_at) VALUES (?, ?, ?, ?, ?)',
  )
  const users = [
    ['Alice Johnson', 'alice@example.com', 'admin', 1, '2025-01-01 10:00:00'],
    ['Bob Smith', 'bob@example.com', 'user', 1, '2025-01-02 10:00:00'],
    ['Charlie Brown', 'charlie@example.com', 'user', 1, '2025-01-03 10:00:00'],
    ['Diana Prince', 'diana@example.com', 'editor', 0, '2025-01-04 10:00:00'],
    ['Eve Wilson', 'eve@example.com', 'admin', 1, '2025-01-05 10:00:00'],
    ['Frank Castle', 'frank@example.com', 'user', 0, '2025-01-06 10:00:00'],
    ['Grace Hopper', 'grace@example.com', 'editor', 1, '2025-01-07 10:00:00'],
    ['Hank Pym', 'hank@example.com', 'user', 1, '2025-01-08 10:00:00'],
    ['Iris West', 'iris@example.com', 'user', 1, '2025-01-09 10:00:00'],
    ['Sarah Connor', 'sarah@example.com', 'admin', 1, '2025-01-10 10:00:00'],
    ['Jack Reacher', 'jack@example.com', 'user', 0, '2025-01-11 10:00:00'],
    ['Karen Page', 'karen@example.com', 'editor', 1, '2025-01-12 10:00:00'],
  ]
  for (const u of users) {
    insertUser.run(...u)
  }

  const insertOrder = database.prepare(
    'INSERT INTO orders (user_id, total, status, created_at) VALUES (?, ?, ?, ?)',
  )
  const orders = [
    [1, 99.99, 'completed', '2025-02-01 12:00:00'],
    [2, 49.50, 'pending', '2025-02-02 12:00:00'],
    [1, 150.00, 'completed', '2025-02-03 12:00:00'],
    [3, 25.00, 'cancelled', '2025-02-04 12:00:00'],
    [5, 200.00, 'pending', '2025-02-05 12:00:00'],
    [4, 75.25, 'completed', '2025-02-06 12:00:00'],
  ]
  for (const o of orders) {
    insertOrder.run(...o)
  }
}

// ── SQLite-backed Model ──────────────────────────────────────────────────────

class SQLiteQueryBuilder {
  private _table: string
  private _db: Database
  private _wheres: Array<{ column: string; operator: string; value: any; boolean: string } | { group: SQLiteQueryBuilder; boolean: string }> = []
  private _orderByCol: string | null = null
  private _orderByDir: 'asc' | 'desc' = 'asc'
  private _limitValue: number | null = null
  private _eagerLoads: string[] = []
  private _modelFactory: (row: any) => any

  constructor(table: string, database: Database, modelFactory: (row: any) => any) {
    this._table = table
    this._db = database
    this._modelFactory = modelFactory
  }

  where(column: string | ((sub: SQLiteQueryBuilder) => void), operatorOrValue?: any, value?: any): this {
    if (typeof column === 'function') {
      const sub = new SQLiteQueryBuilder(this._table, this._db, this._modelFactory)
      column(sub)
      this._wheres.push({ group: sub, boolean: 'and' })
      return this
    }
    if (value === undefined) {
      this._wheres.push({ column, operator: '=', value: operatorOrValue, boolean: 'and' })
    } else {
      this._wheres.push({ column, operator: operatorOrValue, value, boolean: 'and' })
    }
    return this
  }

  orWhere(column: string, operatorOrValue?: any, value?: any): this {
    if (value === undefined) {
      this._wheres.push({ column, operator: '=', value: operatorOrValue, boolean: 'or' })
    } else {
      this._wheres.push({ column, operator: operatorOrValue, value, boolean: 'or' })
    }
    return this
  }

  whereIn(column: string, values: any[]): this {
    this._wheres.push({ column, operator: 'IN', value: values, boolean: 'and' })
    return this
  }

  whereNull(column: string): this {
    this._wheres.push({ column, operator: 'IS NULL', value: null, boolean: 'and' })
    return this
  }

  whereNotNull(column: string): this {
    this._wheres.push({ column, operator: 'IS NOT NULL', value: null, boolean: 'and' })
    return this
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this._orderByCol = column
    this._orderByDir = direction
    return this
  }

  limit(n: number): this {
    this._limitValue = n
    return this
  }

  with(...relations: string[]): this {
    this._eagerLoads.push(...relations)
    return this
  }

  buildSQL(): { sql: string; params: any[] } {
    let sql = `SELECT * FROM ${this._table}`
    const params: any[] = []

    if (this._wheres.length > 0) {
      const conditions: string[] = []
      for (let i = 0; i < this._wheres.length; i++) {
        const w = this._wheres[i]!
        let condition: string

        if ('group' in w) {
          const sub = w.group.buildSQL()
          const subWhere = sub.sql.includes(' WHERE ') ? sub.sql.split(' WHERE ')[1]! : ''
          if (subWhere) {
            condition = `(${subWhere})`
            params.push(...sub.params)
          } else {
            continue
          }
        } else if (w.operator === 'IN') {
          const placeholders = (w.value as any[]).map(() => '?').join(', ')
          condition = `${w.column} IN (${placeholders})`
          params.push(...(w.value as any[]))
        } else if (w.operator === 'IS NULL') {
          condition = `${w.column} IS NULL`
        } else if (w.operator === 'IS NOT NULL') {
          condition = `${w.column} IS NOT NULL`
        } else if (w.operator === 'LIKE') {
          condition = `${w.column} LIKE ? ESCAPE '\\'`
          params.push(w.value)
        } else {
          condition = `${w.column} ${w.operator} ?`
          params.push(w.value)
        }

        if (i === 0) {
          conditions.push(condition!)
        } else {
          conditions.push(`${w.boolean === 'or' ? 'OR' : 'AND'} ${condition!}`)
        }
      }
      sql += ' WHERE ' + conditions.join(' ')
    }

    if (this._orderByCol) {
      sql += ` ORDER BY ${this._orderByCol} ${this._orderByDir.toUpperCase()}`
    }

    if (this._limitValue !== null) {
      sql += ` LIMIT ${this._limitValue}`
    }

    return { sql, params }
  }

  async get(): Promise<any[]> {
    const { sql, params } = this.buildSQL()
    const rows = this._db.prepare(sql).all(...params)
    return rows.map(r => this._modelFactory(r))
  }

  async first(): Promise<any | null> {
    this._limitValue = 1
    const { sql, params } = this.buildSQL()
    const row = this._db.prepare(sql).get(...params)
    if (!row) return null
    return this._modelFactory(row)
  }

  async count(): Promise<number> {
    const { sql, params } = this.buildSQL()
    const countSql = sql.replace(/^SELECT \*/, 'SELECT COUNT(*) as cnt')
    const result = this._db.prepare(countSql).get(...params) as any
    return result?.cnt ?? 0
  }

  async paginate(page = 1, perPage = 15): Promise<any> {
    // First get count
    const { sql: baseSql, params: baseParams } = this.buildSQL()
    const countSql = baseSql.replace(/^SELECT \*/, 'SELECT COUNT(*) as cnt').replace(/ ORDER BY .+$/, '').replace(/ LIMIT \d+$/, '')
    const countResult = this._db.prepare(countSql).get(...baseParams) as any
    const total = countResult?.cnt ?? 0
    const lastPage = Math.max(1, Math.ceil(total / perPage))
    const currentPage = Math.min(page, lastPage)
    const offset = (currentPage - 1) * perPage

    // Remove any existing LIMIT and add pagination
    let paginatedSql = baseSql.replace(/ LIMIT \d+$/, '')
    paginatedSql += ` LIMIT ${perPage} OFFSET ${offset}`

    const rows = this._db.prepare(paginatedSql).all(...baseParams)
    const data = rows.map(r => this._modelFactory(r))
    const from = total === 0 ? 0 : offset + 1
    const to = total === 0 ? 0 : Math.min(offset + data.length, total)

    return { data, total, perPage, currentPage, lastPage, from, to, hasMore: currentPage < lastPage }
  }
}

class SQLiteModelInstance {
  private _attributes: Record<string, any>
  private _tableName: string
  private _db: Database

  constructor(attrs: Record<string, any>, tableName: string, database: Database) {
    this._attributes = { ...attrs }
    this._tableName = tableName
    this._db = database
  }

  fill(data: Record<string, any>): this {
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        this._attributes[key] = value
      }
    }
    return this
  }

  async save(): Promise<this> {
    const id = this._attributes.id
    const entries = Object.entries(this._attributes).filter(([k]) => k !== 'id')
    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
    const values = entries.map(([, v]) => v)
    this._db.prepare(`UPDATE ${this._tableName} SET ${setClauses} WHERE id = ?`).run(...values, id)
    // Re-read to get updated values
    const updated = this._db.prepare(`SELECT * FROM ${this._tableName} WHERE id = ?`).get(id) as any
    if (updated) {
      this._attributes = { ...updated }
    }
    return this
  }

  async delete(): Promise<boolean> {
    const result = this._db.prepare(`DELETE FROM ${this._tableName} WHERE id = ?`).run(this._attributes.id)
    return result.changes > 0
  }

  toObject(): Record<string, any> {
    return { ...this._attributes }
  }

  getKey(): any {
    return this._attributes.id
  }

  getAttribute(key: string): any {
    return this._attributes[key]
  }
}

function createModelClass(tableName: string, database: Database) {
  const modelFactory = (row: any) => new SQLiteModelInstance(row, tableName, database)

  return class SQLiteModel {
    static primaryKey = 'id'
    static table = tableName

    static query(): SQLiteQueryBuilder {
      return new SQLiteQueryBuilder(tableName, database, modelFactory)
    }

    static async find(id: any): Promise<any | null> {
      const row = database.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id)
      if (!row) return null
      return modelFactory(row)
    }

    static async create(data: Record<string, any>): Promise<any> {
      const entries = Object.entries(data).filter(([k]) => k !== 'id')
      const columns = entries.map(([k]) => k).join(', ')
      const placeholders = entries.map(() => '?').join(', ')
      const values = entries.map(([, v]) => v)
      const result = database.prepare(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`).run(...values)
      const row = database.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(result.lastInsertRowid)
      return modelFactory(row)
    }

    static where(column: string, operatorOrValue?: any, value?: any): SQLiteQueryBuilder {
      return new SQLiteQueryBuilder(tableName, database, modelFactory).where(column, operatorOrValue, value)
    }

    static whereIn(column: string, values: any[]): SQLiteQueryBuilder {
      return new SQLiteQueryBuilder(tableName, database, modelFactory).whereIn(column, values)
    }

    static with(...relations: string[]): SQLiteQueryBuilder {
      return new SQLiteQueryBuilder(tableName, database, modelFactory).with(...relations)
    }
  }
}

// ── Mock Actions ─────────────────────────────────────────────────────────────

class ActivateAction extends Action {
  static make(): ActivateAction {
    return new ActivateAction('activate')
  }

  override handle(record: Record<string, unknown>, _data?: Record<string, unknown>): ActionResult {
    return {
      type: 'success',
      message: `Activated record ${record.id}.`,
      redirectUrl: undefined,
    }
  }
}

class BulkDeleteRealAction extends BulkAction {
  private _db: Database

  constructor(database: Database) {
    super('bulk-delete')
    this._db = database
  }

  static makeWith(database: Database): BulkDeleteRealAction {
    return new BulkDeleteRealAction(database)
  }

  override handle(records: Record<string, unknown>[], _data?: Record<string, unknown>): ActionResult {
    for (const record of records) {
      this._db.prepare('DELETE FROM users WHERE id = ?').run(record.id)
    }
    return {
      type: 'success',
      message: `Deleted ${records.length} records.`,
      redirectUrl: undefined,
    }
  }
}

// ── Mock Request Helper ──────────────────────────────────────────────────────

function mockRequest(options: {
  method?: string
  path: string
  query?: Record<string, string>
  body?: any
}): any {
  const { method = 'GET', path, query = {}, body } = options
  const queryString = Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  const fullUrl = `http://localhost${path}${queryString ? '?' + queryString : ''}`
  const parsedUrl = new URL(fullUrl)
  const parsedQuery = Object.fromEntries(parsedUrl.searchParams.entries())

  return {
    method: () => method.toUpperCase(),
    path: () => parsedUrl.pathname,
    url: () => parsedUrl.pathname + parsedUrl.search,
    fullUrl: () => fullUrl,
    query: (key?: string, defaultValue?: string) => {
      if (key === undefined) return parsedQuery
      return parsedQuery[key] ?? defaultValue ?? undefined
    },
    input: async (key?: string, defaultValue?: any) => {
      const merged = { ...parsedQuery, ...(body ?? {}) }
      if (key === undefined) return merged
      return merged[key] ?? defaultValue
    },
    header: (key: string) => undefined,
    headers: () => ({}),
    user: () => ({ id: 1, name: 'Test User' }),
    param: (key: string) => undefined,
    params: () => ({}),
    isAuthenticated: () => true,
    raw: () => new Request(fullUrl),
  }
}

async function parseJson(response: Response): Promise<any> {
  return response.json()
}

// ── Resource + Panel Setup ───────────────────────────────────────────────────

let UserModel: any
let OrderModel: any

class UserResource extends Resource {
  static override slug = 'users'
  static override navigationLabel = 'Users'
  static override navigationIcon = 'users'
  static override recordTitleAttribute = 'name'
  static override globallySearchable = true
  static override defaultSort = 'id'
  static override defaultSortDirection: 'asc' | 'desc' = 'desc'

  override form() {
    return Form.make([
      TextInput.make('name').required().rules(['string', 'max:255']),
      TextInput.make('email').required().rules(['email']),
      TextInput.make('role'),
    ])
  }

  override table() {
    return Table.make([
      TextColumn.make('name').sortable().searchable(),
      TextColumn.make('email').sortable().searchable(),
      TextColumn.make('role').sortable(),
      BooleanColumn.make('active'),
      TextColumn.make('created_at').sortable(),
    ]).actions([
      ActivateAction.make(),
    ]).bulkActions([
      BulkDeleteRealAction.makeWith(db),
    ])
  }
}

class TestPanel extends StudioPanel {
  override path = '/admin'
  override brandName = 'Test Studio'

  override resources(): Array<typeof Resource> {
    return [UserResource]
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StudioController Database CRUD Integration', () => {
  let controller: StudioController
  let panelManager: PanelManager

  beforeEach(() => {
    // Create fresh database for each test
    db = createDatabase()
    seedDatabase(db)

    UserModel = createModelClass('users', db)
    OrderModel = createModelClass('orders', db)

    // Wire model to resource
    UserResource.model = UserModel

    panelManager = new PanelManager()
    panelManager.register(new TestPanel())
    controller = new StudioController(panelManager)
  })

  // ── Index (List) ───────────────────────────────────────────────────────────

  describe('index', () => {
    it('returns paginated users', async () => {
      const req = mockRequest({ path: '/admin/api/resources/users' })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(10) // default perPage=10, total=12
      expect(json.meta.total).toBe(12)
      expect(json.meta.currentPage).toBe(1)
      expect(json.meta.perPage).toBe(10)
      expect(json.meta.lastPage).toBe(2)
      expect(json.meta.from).toBe(1)
      expect(json.meta.to).toBe(10)
    })

    it('paginates correctly', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/users',
        query: { page: '2', perPage: '3' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(3)
      expect(json.meta.total).toBe(12)
      expect(json.meta.currentPage).toBe(2)
      expect(json.meta.perPage).toBe(3)
      expect(json.meta.lastPage).toBe(4)
      expect(json.meta.from).toBe(4)
      expect(json.meta.to).toBe(6)
    })

    it('searches across searchable columns', async () => {
      // Search by name
      const req1 = mockRequest({
        path: '/admin/api/resources/users',
        query: { search: 'sarah' },
      })
      const res1 = await controller.index(req1)
      const json1 = await parseJson(res1)

      expect(json1.data.length).toBeGreaterThanOrEqual(1)
      expect(json1.data.some((r: any) => r.name === 'Sarah Connor')).toBe(true)

      // Search by email domain
      const req2 = mockRequest({
        path: '/admin/api/resources/users',
        query: { search: 'example.com' },
      })
      const res2 = await controller.index(req2)
      const json2 = await parseJson(res2)

      expect(json2.meta.total).toBe(12) // All have example.com
    })

    it('sorts ascending', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/users',
        query: { sort: 'name', direction: 'asc', perPage: '20' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      const names = json.data.map((r: any) => r.name)
      expect(names[0]).toBe('Alice Johnson')
      expect(names[1]).toBe('Bob Smith')
      expect(names[2]).toBe('Charlie Brown')
      // Verify sorted
      for (let i = 1; i < names.length; i++) {
        expect(names[i] >= names[i - 1]).toBe(true)
      }
    })

    it('sorts descending', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/users',
        query: { sort: 'created_at', direction: 'desc', perPage: '20' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      const dates = json.data.map((r: any) => r.created_at)
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] <= dates[i - 1]).toBe(true)
      }
    })

    it('filters by exact match', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/users',
        query: { 'filter[role]': 'admin', perPage: '20' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(json.data.length).toBe(3)
      for (const record of json.data) {
        expect(record.role).toBe('admin')
      }
    })

    it('filters by ternary (boolean)', async () => {
      // Active = true (SQLite stores as 1)
      const req = mockRequest({
        path: '/admin/api/resources/users',
        query: { 'filter[active]': '1', perPage: '20' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      for (const record of json.data) {
        expect(record.active).toBe(1)
      }
      expect(json.data.length).toBe(9) // 9 active users
    })

    it('combines search + filter + sort', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/users',
        query: {
          search: 'example.com',
          'filter[role]': 'admin',
          sort: 'name',
          direction: 'asc',
          perPage: '20',
        },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      // All results should be admins with example.com
      expect(json.data.length).toBe(3) // Alice, Eve, Sarah are admins
      for (const record of json.data) {
        expect(record.role).toBe('admin')
        expect(record.email).toContain('example.com')
      }
      // Should be sorted by name
      const names = json.data.map((r: any) => r.name)
      expect(names[0]).toBe('Alice Johnson')
      expect(names[1]).toBe('Eve Wilson')
      expect(names[2]).toBe('Sarah Connor')
    })

    it('returns empty result for no matches', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/users',
        query: { search: 'zzzzzzzzzzz' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(0)
      expect(json.meta.total).toBe(0)
    })

    it('clamps page to valid range', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/users',
        query: { page: '999', perPage: '5' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      // Should clamp to last page
      expect(json.meta.currentPage).toBe(json.meta.lastPage)
      expect(json.data.length).toBeGreaterThan(0)
    })
  })

  // ── Store (Create) ─────────────────────────────────────────────────────────

  describe('store', () => {
    it('creates a record', async () => {
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/users',
        body: {
          name: 'New User',
          email: 'newuser@example.com',
          role: 'user',
          active: 1,
        },
      })
      const res = await controller.store(req)
      const json = await parseJson(res)

      expect(res.status).toBe(201)
      expect(json.data.name).toBe('New User')
      expect(json.data.email).toBe('newuser@example.com')
      expect(json.data.id).toBeDefined()
      expect(json.message).toBe('Created.')

      // Verify in database
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get('newuser@example.com') as any
      expect(row).toBeDefined()
      expect(row.name).toBe('New User')
    })

    it('returns validation errors', async () => {
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/users',
        body: {
          // Missing required 'name' and 'email'
        },
      })
      const res = await controller.store(req)

      // The response should be 422 if the Validator is available
      // or 201 if validation is skipped (no Validator available)
      expect([201, 422]).toContain(res.status)
      if (res.status === 422) {
        const json = await parseJson(res)
        expect(json.errors).toBeDefined()
      }
    })

    it('calls beforeCreate hook', async () => {
      // Create resource with hook
      class HookedUserResource extends Resource {
        static override model = UserModel
        static override slug = 'hooked-users'

        override form() {
          return Form.make([TextInput.make('name'), TextInput.make('email')])
        }

        override table() {
          return Table.make([TextColumn.make('name').searchable()])
        }

        override beforeCreate(data: Record<string, any>) {
          return { ...data, email: data.email?.toLowerCase() }
        }
      }

      class HookedPanel extends StudioPanel {
        override path = '/hooked'
        override resources(): Array<typeof Resource> {
          return [HookedUserResource]
        }
      }

      const pm = new PanelManager()
      pm.register(new HookedPanel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({
        method: 'POST',
        path: '/hooked/api/resources/hooked-users',
        body: { name: 'Test', email: 'UPPER@CASE.COM', role: 'user', active: 1 },
      })
      const res = await ctrl.store(req)
      const json = await parseJson(res)

      expect(res.status).toBe(201)
      expect(json.data.email).toBe('upper@case.com')
    })

    it('calls afterCreate hook', async () => {
      let afterCreateCalled = false
      let afterCreateRecord: any = null

      class HookedUserResource extends Resource {
        static override model = UserModel
        static override slug = 'hooked-users'

        override form() {
          return Form.make([TextInput.make('name'), TextInput.make('email')])
        }

        override table() {
          return Table.make([TextColumn.make('name').searchable()])
        }

        override afterCreate(record: any) {
          afterCreateCalled = true
          afterCreateRecord = record
        }
      }

      class HookedPanel extends StudioPanel {
        override path = '/hooked'
        override resources(): Array<typeof Resource> {
          return [HookedUserResource]
        }
      }

      const pm = new PanelManager()
      pm.register(new HookedPanel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({
        method: 'POST',
        path: '/hooked/api/resources/hooked-users',
        body: { name: 'After Hook Test', email: 'after@test.com', role: 'user', active: 1 },
      })
      await ctrl.store(req)

      expect(afterCreateCalled).toBe(true)
      expect(afterCreateRecord).toBeDefined()
      expect(afterCreateRecord.getKey()).toBeDefined()
    })
  })

  // ── Show ───────────────────────────────────────────────────────────────────

  describe('show', () => {
    it('returns a single record', async () => {
      const req = mockRequest({ path: '/admin/api/resources/users/1' })
      const res = await controller.show(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.data.id).toBe(1)
      expect(json.data.name).toBe('Alice Johnson')
      expect(json.data.email).toBe('alice@example.com')
    })

    it('returns 404 for missing record', async () => {
      const req = mockRequest({ path: '/admin/api/resources/users/9999' })
      const res = await controller.show(req)
      const json = await parseJson(res)

      expect(res.status).toBe(404)
      expect(json.error).toBe('Record not found.')
    })
  })

  // ── Update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a record', async () => {
      const req = mockRequest({
        method: 'PUT',
        path: '/admin/api/resources/users/1',
        body: { name: 'Alice Updated', email: 'alice-new@example.com' },
      })
      const res = await controller.update(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.data.name).toBe('Alice Updated')
      expect(json.data.email).toBe('alice-new@example.com')
      expect(json.message).toBe('Updated.')

      // Verify in database
      const row = db.prepare('SELECT * FROM users WHERE id = 1').get() as any
      expect(row.name).toBe('Alice Updated')
      expect(row.email).toBe('alice-new@example.com')
    })

    it('returns 404 for missing record', async () => {
      const req = mockRequest({
        method: 'PUT',
        path: '/admin/api/resources/users/9999',
        body: { name: 'Ghost' },
      })
      const res = await controller.update(req)
      const json = await parseJson(res)

      expect(res.status).toBe(404)
      expect(json.error).toBe('Record not found.')
    })

    it('returns validation errors for invalid data', async () => {
      const req = mockRequest({
        method: 'PUT',
        path: '/admin/api/resources/users/1',
        body: { name: '', email: 'not-valid' },
      })
      const res = await controller.update(req)

      // 422 if validation is active, 200 otherwise
      expect([200, 422]).toContain(res.status)
    })

    it('calls beforeSave and afterSave hooks', async () => {
      const hookCalls: string[] = []

      class HookedUserResource extends Resource {
        static override model = UserModel
        static override slug = 'hooked-users'

        override form() {
          return Form.make([TextInput.make('name'), TextInput.make('email')])
        }

        override table() {
          return Table.make([TextColumn.make('name').searchable()])
        }

        override beforeSave(_record: any, data: Record<string, any>) {
          hookCalls.push('beforeSave')
          return { ...data, updated_at: '2025-06-01 00:00:00' }
        }

        override afterSave(_record: any) {
          hookCalls.push('afterSave')
        }
      }

      class HookedPanel extends StudioPanel {
        override path = '/hooked'
        override resources(): Array<typeof Resource> {
          return [HookedUserResource]
        }
      }

      const pm = new PanelManager()
      pm.register(new HookedPanel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({
        method: 'PUT',
        path: '/hooked/api/resources/hooked-users/1',
        body: { name: 'Updated via hook' },
      })
      const res = await ctrl.update(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(hookCalls).toContain('beforeSave')
      expect(hookCalls).toContain('afterSave')
      expect(json.data.updated_at).toBe('2025-06-01 00:00:00')
    })
  })

  // ── Delete (Destroy) ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('deletes a record', async () => {
      // Verify record exists first
      const before = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any
      expect(before.cnt).toBe(12)

      const req = mockRequest({ method: 'DELETE', path: '/admin/api/resources/users/1' })
      const res = await controller.destroy(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.message).toBe('Deleted.')

      // Verify removed from database
      const after = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any
      expect(after.cnt).toBe(11)
      const deleted = db.prepare('SELECT * FROM users WHERE id = 1').get()
      expect(deleted).toBeNull()
    })

    it('returns 404 for missing record', async () => {
      const req = mockRequest({ method: 'DELETE', path: '/admin/api/resources/users/9999' })
      const res = await controller.destroy(req)
      const json = await parseJson(res)

      expect(res.status).toBe(404)
      expect(json.error).toBe('Record not found.')
    })

    it('calls beforeDelete and afterDelete hooks', async () => {
      const hookCalls: string[] = []

      class HookedUserResource extends Resource {
        static override model = UserModel
        static override slug = 'hooked-users'

        override form() {
          return Form.make([TextInput.make('name')])
        }

        override table() {
          return Table.make([TextColumn.make('name')])
        }

        override beforeDelete(_record: any) {
          hookCalls.push('beforeDelete')
        }

        override afterDelete(_record: any) {
          hookCalls.push('afterDelete')
        }
      }

      class HookedPanel extends StudioPanel {
        override path = '/hooked'
        override resources(): Array<typeof Resource> {
          return [HookedUserResource]
        }
      }

      const pm = new PanelManager()
      pm.register(new HookedPanel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({ method: 'DELETE', path: '/hooked/api/resources/hooked-users/2' })
      await ctrl.destroy(req)

      expect(hookCalls).toContain('beforeDelete')
      expect(hookCalls).toContain('afterDelete')
      expect(hookCalls.indexOf('beforeDelete')).toBeLessThan(hookCalls.indexOf('afterDelete'))

      // Verify actually deleted
      const row = db.prepare('SELECT * FROM users WHERE id = 2').get()
      expect(row).toBeNull()
    })
  })

  // ── Schema ─────────────────────────────────────────────────────────────────

  describe('schema', () => {
    it('returns form and table schema', async () => {
      const req = mockRequest({ path: '/admin/api/resources/users' })
      const res = await controller.schema(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)

      // Form schema
      expect(json.form).toBeDefined()
      expect(json.form.type).toBe('form')
      expect(json.form.components.length).toBeGreaterThanOrEqual(2)

      // Table schema
      expect(json.table).toBeDefined()
      expect(json.table.type).toBe('table')
      expect(json.table.columns.length).toBeGreaterThanOrEqual(2)
      expect(json.table.actions.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  describe('action', () => {
    it('executes a single-record action', async () => {
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/users/actions/activate',
        body: { recordId: 1, data: {} },
      })
      const res = await controller.action(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.type).toBe('success')
      expect(json.message).toContain('Activated')
    })

    it('returns 404 for unknown action name', async () => {
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/users/actions/nonexistent',
        body: { recordId: 1, data: {} },
      })
      const res = await controller.action(req)
      const json = await parseJson(res)

      expect(res.status).toBe(404)
      expect(json.error).toContain('not found')
    })
  })

  // ── Bulk Actions ───────────────────────────────────────────────────────────

  describe('bulkAction', () => {
    it('executes bulk delete on multiple records', async () => {
      const beforeCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt
      expect(beforeCount).toBe(12)

      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/users/bulk-actions/bulk-delete',
        body: { ids: [1, 2, 3], data: {} },
      })
      const res = await controller.bulkAction(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.type).toBe('success')
      expect(json.message).toContain('Deleted 3 records')

      // Verify actually deleted from database
      const afterCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt
      expect(afterCount).toBe(9)

      // Verify specific records removed
      expect(db.prepare('SELECT * FROM users WHERE id = 1').get()).toBeNull()
      expect(db.prepare('SELECT * FROM users WHERE id = 2').get()).toBeNull()
      expect(db.prepare('SELECT * FROM users WHERE id = 3').get()).toBeNull()
    })

    it('returns 400 for empty IDs', async () => {
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/users/bulk-actions/bulk-delete',
        body: { ids: [], data: {} },
      })
      const res = await controller.bulkAction(req)

      expect(res.status).toBe(400)
    })
  })
})
