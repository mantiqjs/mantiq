// @ts-nocheck
import { describe, it, expect, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { StudioController } from '../../src/http/StudioController.ts'
import { PanelManager } from '../../src/panel/PanelManager.ts'
import { StudioPanel } from '../../src/StudioPanel.ts'
import { Resource } from '../../src/resources/Resource.ts'
import { Form } from '../../src/forms/Form.ts'
import { TextInput } from '../../src/forms/components/TextInput.ts'
import { Table } from '../../src/tables/Table.ts'
import { TextColumn } from '../../src/tables/columns/TextColumn.ts'

// ── SQLite Database Setup ────────────────────────────────────────────────────

let db: Database

function createDatabase(): Database {
  const database = new Database(':memory:')
  database.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );
  `)
  return database
}

function seedDatabase(database: Database): void {
  const insert = database.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)')
  insert.run('Alice', 'alice@example.com', 'admin')
  insert.run('Bob', 'bob@example.com', 'user')
  insert.run('Charlie', 'charlie@example.com', 'user')
}

// ── SQLite-backed Model ──────────────────────────────────────────────────────

class SQLiteQueryBuilder {
  private _table: string
  private _db: Database
  private _wheres: Array<{ column: string; operator: string; value: any; boolean: string }> = []
  private _orderByCol: string | null = null
  private _orderByDir: 'asc' | 'desc' = 'asc'
  private _limitValue: number | null = null
  private _modelFactory: (row: any) => any

  constructor(table: string, database: Database, modelFactory: (row: any) => any) {
    this._table = table
    this._db = database
    this._modelFactory = modelFactory
  }

  where(column: string, operatorOrValue?: any, value?: any): this {
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

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this._orderByCol = column
    this._orderByDir = direction
    return this
  }

  limit(n: number): this {
    this._limitValue = n
    return this
  }

  with(..._relations: string[]): this {
    return this
  }

  private buildSQL(): { sql: string; params: any[] } {
    let sql = `SELECT * FROM ${this._table}`
    const params: any[] = []

    if (this._wheres.length > 0) {
      const conditions: string[] = []
      for (let i = 0; i < this._wheres.length; i++) {
        const w = this._wheres[i]
        let condition: string
        if (w.operator === 'IN') {
          const placeholders = (w.value as any[]).map(() => '?').join(', ')
          condition = `${w.column} IN (${placeholders})`
          params.push(...(w.value as any[]))
        } else if (w.operator === 'LIKE') {
          condition = `${w.column} LIKE ? ESCAPE '\\'`
          params.push(w.value)
        } else {
          condition = `${w.column} ${w.operator} ?`
          params.push(w.value)
        }

        if (i === 0) {
          conditions.push(condition)
        } else {
          conditions.push(`${w.boolean === 'or' ? 'OR' : 'AND'} ${condition}`)
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
    return this._db.prepare(sql).all(...params).map(r => this._modelFactory(r))
  }

  async first(): Promise<any | null> {
    this._limitValue = 1
    const { sql, params } = this.buildSQL()
    const row = this._db.prepare(sql).get(...params)
    return row ? this._modelFactory(row) : null
  }

  async paginate(page = 1, perPage = 15): Promise<any> {
    const { sql: baseSql, params: baseParams } = this.buildSQL()
    const countSql = baseSql.replace(/^SELECT \*/, 'SELECT COUNT(*) as cnt').replace(/ ORDER BY .+$/, '').replace(/ LIMIT \d+$/, '')
    const total = (this._db.prepare(countSql).get(...baseParams) as any)?.cnt ?? 0
    const lastPage = Math.max(1, Math.ceil(total / perPage))
    const currentPage = Math.min(page, lastPage)
    const offset = (currentPage - 1) * perPage

    let paginatedSql = baseSql.replace(/ LIMIT \d+$/, '') + ` LIMIT ${perPage} OFFSET ${offset}`
    const rows = this._db.prepare(paginatedSql).all(...baseParams)
    const data = rows.map(r => this._modelFactory(r))
    const from = total === 0 ? 0 : offset + 1
    const to = total === 0 ? 0 : Math.min(offset + data.length, total)
    return { data, total, perPage, currentPage, lastPage, from, to }
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
      if (key !== 'id') this._attributes[key] = value
    }
    return this
  }

  async save(): Promise<this> {
    const id = this._attributes.id
    const entries = Object.entries(this._attributes).filter(([k]) => k !== 'id')
    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
    const values = entries.map(([, v]) => v)
    this._db.prepare(`UPDATE ${this._tableName} SET ${setClauses} WHERE id = ?`).run(...values, id)
    return this
  }

  async delete(): Promise<boolean> {
    const result = this._db.prepare(`DELETE FROM ${this._tableName} WHERE id = ?`).run(this._attributes.id)
    return result.changes > 0
  }

  toObject(): Record<string, any> { return { ...this._attributes } }
  getKey(): any { return this._attributes.id }
}

function createModelClass(tableName: string, database: Database) {
  const modelFactory = (row: any) => new SQLiteModelInstance(row, tableName, database)

  return class {
    static primaryKey = 'id'
    static table = tableName

    static query() { return new SQLiteQueryBuilder(tableName, database, modelFactory) }

    static async find(id: any) {
      const row = database.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id)
      return row ? modelFactory(row) : null
    }

    static async create(data: Record<string, any>) {
      const entries = Object.entries(data).filter(([k]) => k !== 'id')
      const columns = entries.map(([k]) => k).join(', ')
      const placeholders = entries.map(() => '?').join(', ')
      const values = entries.map(([, v]) => v)
      const result = database.prepare(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`).run(...values)
      return modelFactory(database.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(result.lastInsertRowid))
    }

    static where(column: string, opOrVal?: any, val?: any) {
      return new SQLiteQueryBuilder(tableName, database, modelFactory).where(column, opOrVal, val)
    }

    static whereIn(column: string, values: any[]) {
      return new SQLiteQueryBuilder(tableName, database, modelFactory).whereIn(column, values)
    }

    static with(...relations: string[]) {
      return new SQLiteQueryBuilder(tableName, database, modelFactory).with(...relations)
    }
  }
}

// ── Mock Request Helper ──────────────────────────────────────────────────────

function mockRequest(options: {
  method?: string
  path: string
  query?: Record<string, string>
  body?: any
  user?: any
}): any {
  const { method = 'GET', path, query = {}, body, user = { id: 1, name: 'Admin' } } = options
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
    header: () => undefined,
    headers: () => ({}),
    user: () => user,
    param: () => undefined,
    params: () => ({}),
    isAuthenticated: () => !!user,
    raw: () => new Request(fullUrl),
  }
}

async function parseJson(response: Response): Promise<any> {
  return response.json()
}

// ── Resource Definitions ─────────────────────────────────────────────────────

let UserModel: any

/** Default resource — all authorization methods return true (base defaults). */
class AllowedResource extends Resource {
  static override slug = 'allowed-users'

  override form() {
    return Form.make([TextInput.make('name'), TextInput.make('email')])
  }
  override table() {
    return Table.make([TextColumn.make('name').searchable(), TextColumn.make('email').searchable()])
  }
}

/** Resource that denies viewAny. */
class DenyViewAnyResource extends Resource {
  static override slug = 'deny-view-users'

  static override canViewAny(_user: any): boolean { return false }

  override form() {
    return Form.make([TextInput.make('name'), TextInput.make('email')])
  }
  override table() {
    return Table.make([TextColumn.make('name').searchable()])
  }
}

/** Resource that denies create. */
class DenyCreateResource extends Resource {
  static override slug = 'deny-create-users'

  static override canCreate(_user: any): boolean { return false }

  override form() {
    return Form.make([TextInput.make('name'), TextInput.make('email')])
  }
  override table() {
    return Table.make([TextColumn.make('name').searchable()])
  }
}

/** Resource that denies update. */
class DenyUpdateResource extends Resource {
  static override slug = 'deny-update-users'

  static override canUpdate(_user: any, _record: any): boolean { return false }

  override form() {
    return Form.make([TextInput.make('name'), TextInput.make('email')])
  }
  override table() {
    return Table.make([TextColumn.make('name').searchable()])
  }
}

/** Resource that denies delete. */
class DenyDeleteResource extends Resource {
  static override slug = 'deny-delete-users'

  static override canDelete(_user: any, _record: any): boolean { return false }

  override form() {
    return Form.make([TextInput.make('name'), TextInput.make('email')])
  }
  override table() {
    return Table.make([TextColumn.make('name').searchable()])
  }
}

/** Panel that denies access. */
class DenyAccessPanel extends StudioPanel {
  override path = '/denied'
  override brandName = 'Denied'

  override canAccess(_user: any): boolean { return false }

  override resources(): Array<typeof Resource> {
    return [AllowedResource]
  }
}

class AllowedPanel extends StudioPanel {
  override path = '/admin'
  override brandName = 'Admin'
  override resources(): Array<typeof Resource> {
    return [AllowedResource]
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StudioController Authorization', () => {
  beforeEach(() => {
    db = createDatabase()
    seedDatabase(db)
    UserModel = createModelClass('users', db)

    // Wire models to all resource classes
    AllowedResource.model = UserModel
    DenyViewAnyResource.model = UserModel
    DenyCreateResource.model = UserModel
    DenyUpdateResource.model = UserModel
    DenyDeleteResource.model = UserModel
  })

  describe('canViewAny', () => {
    it('returns 403 on index when canViewAny returns false', async () => {
      class Panel extends StudioPanel {
        override path = '/admin'
        override resources() { return [DenyViewAnyResource] }
      }

      const pm = new PanelManager()
      pm.register(new Panel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({ path: '/admin/api/resources/deny-view-users' })
      const res = await ctrl.index(req)

      expect(res.status).toBe(403)
      const json = await parseJson(res)
      expect(json.error).toBe('Forbidden.')
    })
  })

  describe('canCreate', () => {
    it('returns 403 on store when canCreate returns false', async () => {
      class Panel extends StudioPanel {
        override path = '/admin'
        override resources() { return [DenyCreateResource] }
      }

      const pm = new PanelManager()
      pm.register(new Panel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/deny-create-users',
        body: { name: 'Test', email: 'test@test.com' },
      })
      const res = await ctrl.store(req)

      expect(res.status).toBe(403)
      const json = await parseJson(res)
      expect(json.error).toBe('Forbidden.')

      // Verify no record was created
      const count = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt
      expect(count).toBe(3) // Still just the seeded records
    })
  })

  describe('canUpdate', () => {
    it('returns 403 on update when canUpdate returns false', async () => {
      class Panel extends StudioPanel {
        override path = '/admin'
        override resources() { return [DenyUpdateResource] }
      }

      const pm = new PanelManager()
      pm.register(new Panel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({
        method: 'PUT',
        path: '/admin/api/resources/deny-update-users/1',
        body: { name: 'Should Not Update' },
      })
      const res = await ctrl.update(req)

      expect(res.status).toBe(403)
      const json = await parseJson(res)
      expect(json.error).toBe('Forbidden.')

      // Verify record was not changed
      const row = db.prepare('SELECT * FROM users WHERE id = 1').get() as any
      expect(row.name).toBe('Alice')
    })
  })

  describe('canDelete', () => {
    it('returns 403 on destroy when canDelete returns false', async () => {
      class Panel extends StudioPanel {
        override path = '/admin'
        override resources() { return [DenyDeleteResource] }
      }

      const pm = new PanelManager()
      pm.register(new Panel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({
        method: 'DELETE',
        path: '/admin/api/resources/deny-delete-users/1',
      })
      const res = await ctrl.destroy(req)

      expect(res.status).toBe(403)
      const json = await parseJson(res)
      expect(json.error).toBe('Forbidden.')

      // Verify record still exists
      const row = db.prepare('SELECT * FROM users WHERE id = 1').get()
      expect(row).not.toBeNull()
    })
  })

  describe('canAccess on panel', () => {
    it('returns 403 when panel canAccess returns false', async () => {
      const pm = new PanelManager()
      pm.register(new DenyAccessPanel())
      const ctrl = new StudioController(pm)

      const req = mockRequest({ path: '/denied/api/panel' })
      const res = await ctrl.panel(req)

      expect(res.status).toBe(403)
      const json = await parseJson(res)
      expect(json.error).toBe('Forbidden.')
    })
  })

  describe('authorization defaults', () => {
    it('allows everything by default', async () => {
      const pm = new PanelManager()
      pm.register(new AllowedPanel())
      const ctrl = new StudioController(pm)

      // Index should work
      const indexReq = mockRequest({ path: '/admin/api/resources/allowed-users' })
      const indexRes = await ctrl.index(indexReq)
      expect(indexRes.status).toBe(200)

      // Store should work
      const storeReq = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/allowed-users',
        body: { name: 'Default Auth', email: 'default@test.com', role: 'user' },
      })
      const storeRes = await ctrl.store(storeReq)
      expect(storeRes.status).toBe(201)

      // Update should work
      const updateReq = mockRequest({
        method: 'PUT',
        path: '/admin/api/resources/allowed-users/1',
        body: { name: 'Updated Default' },
      })
      const updateRes = await ctrl.update(updateReq)
      expect(updateRes.status).toBe(200)

      // Delete should work
      const deleteReq = mockRequest({
        method: 'DELETE',
        path: '/admin/api/resources/allowed-users/2',
      })
      const deleteRes = await ctrl.destroy(deleteReq)
      expect(deleteRes.status).toBe(200)

      // Panel should work
      const panelReq = mockRequest({ path: '/admin/api/panel' })
      const panelRes = await ctrl.panel(panelReq)
      expect(panelRes.status).toBe(200)
    })
  })
})
