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
    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT,
      updated_by TEXT,
      audit_log TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  return database
}

function seedDatabase(database: Database): void {
  const insert = database.prepare(
    'INSERT INTO items (name, slug, status) VALUES (?, ?, ?)',
  )
  insert.run('Item One', 'item-one', 'published')
  insert.run('Item Two', 'item-two', 'draft')
  insert.run('Item Three', 'item-three', 'archived')
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

  with(..._relations: string[]): this { return this }

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
    // Re-read for updated values
    const updated = this._db.prepare(`SELECT * FROM ${this._tableName} WHERE id = ?`).get(id) as any
    if (updated) this._attributes = { ...updated }
    return this
  }

  async delete(): Promise<boolean> {
    return this._db.prepare(`DELETE FROM ${this._tableName} WHERE id = ?`).run(this._attributes.id).changes > 0
  }

  toObject(): Record<string, any> { return { ...this._attributes } }
  getKey(): any { return this._attributes.id }
  getAttribute(key: string): any { return this._attributes[key] }
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
    header: () => undefined,
    headers: () => ({}),
    user: () => ({ id: 1, name: 'Test User' }),
    param: () => undefined,
    params: () => ({}),
    isAuthenticated: () => true,
    raw: () => new Request(fullUrl),
  }
}

async function parseJson(response: Response): Promise<any> {
  return response.json()
}

// ── Helper to create controller ──────────────────────────────────────────────

let ItemModel: any

function makeController(ResourceClass: typeof Resource): StudioController {
  class Panel extends StudioPanel {
    override path = '/admin'
    override resources(): Array<typeof Resource> { return [ResourceClass] }
  }
  const pm = new PanelManager()
  pm.register(new Panel())
  return new StudioController(pm)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StudioController Lifecycle Hooks Integration', () => {
  beforeEach(() => {
    db = createDatabase()
    seedDatabase(db)
    ItemModel = createModelClass('items', db)
  })

  // ── beforeCreate ─────────────────────────────────────────────────────────

  describe('beforeCreate', () => {
    it('can modify data', async () => {
      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override beforeCreate(data: Record<string, any>) {
          return {
            ...data,
            slug: data.name?.toLowerCase().replace(/\s+/g, '-'),
            created_by: 'hook-system',
          }
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/items',
        body: { name: 'My New Item', status: 'draft' },
      })
      const res = await ctrl.store(req)
      const json = await parseJson(res)

      expect(res.status).toBe(201)
      expect(json.data.slug).toBe('my-new-item')
      expect(json.data.created_by).toBe('hook-system')

      // Verify in database
      const row = db.prepare('SELECT * FROM items WHERE id = ?').get(json.data.id) as any
      expect(row.slug).toBe('my-new-item')
      expect(row.created_by).toBe('hook-system')
    })

    it('can reject by throwing error', async () => {
      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override beforeCreate(data: Record<string, any>) {
          if (data.name === 'FORBIDDEN') {
            throw new Error('Cannot create item with forbidden name.')
          }
          return data
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/items',
        body: { name: 'FORBIDDEN', status: 'draft' },
      })
      const res = await ctrl.store(req)
      const json = await parseJson(res)

      expect(res.status).toBe(500)
      expect(json.error).toContain('Cannot create item with forbidden name')

      // Verify no record was created
      const count = (db.prepare('SELECT COUNT(*) as cnt FROM items').get() as any).cnt
      expect(count).toBe(3) // Only seeded records
    })
  })

  // ── afterCreate ────────────────────────────────────────────────────────────

  describe('afterCreate', () => {
    it('receives the created record with an ID', async () => {
      let receivedRecord: any = null

      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override afterCreate(record: any) {
          receivedRecord = record
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/items',
        body: { name: 'Created Item', status: 'draft' },
      })
      await ctrl.store(req)

      expect(receivedRecord).not.toBeNull()
      expect(receivedRecord.getKey()).toBeDefined()
      expect(receivedRecord.getKey()).toBeGreaterThan(0)
      expect(receivedRecord.toObject().name).toBe('Created Item')
    })
  })

  // ── beforeSave (update) ────────────────────────────────────────────────────

  describe('beforeSave', () => {
    it('can modify data on update', async () => {
      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override beforeSave(_record: any, data: Record<string, any>) {
          return {
            ...data,
            updated_by: 'save-hook',
            slug: data.name?.toLowerCase().replace(/\s+/g, '-'),
          }
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'PUT',
        path: '/admin/api/resources/items/1',
        body: { name: 'Updated Name' },
      })
      const res = await ctrl.update(req)
      const json = await parseJson(res)

      expect(res.status).toBe(200)
      expect(json.data.updated_by).toBe('save-hook')
      expect(json.data.slug).toBe('updated-name')

      // Verify in database
      const row = db.prepare('SELECT * FROM items WHERE id = 1').get() as any
      expect(row.updated_by).toBe('save-hook')
    })
  })

  // ── afterSave ──────────────────────────────────────────────────────────────

  describe('afterSave', () => {
    it('receives the updated record', async () => {
      let receivedRecord: any = null

      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override afterSave(record: any) {
          receivedRecord = record
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'PUT',
        path: '/admin/api/resources/items/1',
        body: { name: 'After Save Test' },
      })
      await ctrl.update(req)

      expect(receivedRecord).not.toBeNull()
      expect(receivedRecord.toObject().name).toBe('After Save Test')
    })
  })

  // ── beforeDelete ──────────────────────────────────────────────────────────

  describe('beforeDelete', () => {
    it('can prevent deletion by throwing error', async () => {
      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override beforeDelete(record: any) {
          if (record.toObject().status === 'published') {
            throw new Error('Cannot delete published items.')
          }
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)

      // Item 1 is 'published' — should be rejected
      const req = mockRequest({
        method: 'DELETE',
        path: '/admin/api/resources/items/1',
      })
      const res = await ctrl.destroy(req)
      const json = await parseJson(res)

      expect(res.status).toBe(500)
      expect(json.error).toContain('Cannot delete published items')

      // Verify record still exists
      const row = db.prepare('SELECT * FROM items WHERE id = 1').get()
      expect(row).not.toBeNull()

      // Item 2 is 'draft' — should be allowed
      const req2 = mockRequest({
        method: 'DELETE',
        path: '/admin/api/resources/items/2',
      })
      const res2 = await ctrl.destroy(req2)

      expect(res2.status).toBe(200)
      const deleted = db.prepare('SELECT * FROM items WHERE id = 2').get()
      expect(deleted).toBeNull()
    })
  })

  // ── afterDelete ────────────────────────────────────────────────────────────

  describe('afterDelete', () => {
    it('runs after record is removed', async () => {
      let afterDeleteCalled = false
      let deletedRecordData: any = null

      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override afterDelete(record: any) {
          afterDeleteCalled = true
          deletedRecordData = record.toObject()
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'DELETE',
        path: '/admin/api/resources/items/2',
      })
      await ctrl.destroy(req)

      expect(afterDeleteCalled).toBe(true)
      expect(deletedRecordData).toBeDefined()
      expect(deletedRecordData.id).toBe(2)
      expect(deletedRecordData.name).toBe('Item Two')

      // Verify actually removed from DB
      const row = db.prepare('SELECT * FROM items WHERE id = 2').get()
      expect(row).toBeNull()
    })
  })

  // ── Hook Execution Order ───────────────────────────────────────────────────

  describe('hook ordering', () => {
    it('hooks run in correct order for create', async () => {
      const callOrder: string[] = []

      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override beforeCreate(data: Record<string, any>) {
          callOrder.push('beforeCreate')
          return data
        }

        override afterCreate(_record: any) {
          callOrder.push('afterCreate')
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/items',
        body: { name: 'Order Test', status: 'draft' },
      })
      await ctrl.store(req)

      expect(callOrder).toEqual(['beforeCreate', 'afterCreate'])
    })

    it('hooks run in correct order for update', async () => {
      const callOrder: string[] = []

      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override beforeSave(_record: any, data: Record<string, any>) {
          callOrder.push('beforeSave')
          return data
        }

        override afterSave(_record: any) {
          callOrder.push('afterSave')
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'PUT',
        path: '/admin/api/resources/items/1',
        body: { name: 'Order Update Test' },
      })
      await ctrl.update(req)

      expect(callOrder).toEqual(['beforeSave', 'afterSave'])
    })

    it('hooks run in correct order for delete', async () => {
      const callOrder: string[] = []

      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override beforeDelete(_record: any) {
          callOrder.push('beforeDelete')
        }

        override afterDelete(_record: any) {
          callOrder.push('afterDelete')
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)
      const req = mockRequest({
        method: 'DELETE',
        path: '/admin/api/resources/items/2',
      })
      await ctrl.destroy(req)

      expect(callOrder).toEqual(['beforeDelete', 'afterDelete'])
    })

    it('tracks full lifecycle order across operations', async () => {
      const callOrder: string[] = []

      class ItemResource extends Resource {
        static override model = ItemModel
        static override slug = 'items'

        override form() { return Form.make([TextInput.make('name')]) }
        override table() { return Table.make([TextColumn.make('name')]) }

        override beforeCreate(data: Record<string, any>) {
          callOrder.push('beforeCreate')
          return data
        }
        override afterCreate(_record: any) {
          callOrder.push('afterCreate')
        }
        override beforeSave(_record: any, data: Record<string, any>) {
          callOrder.push('beforeSave')
          return data
        }
        override afterSave(_record: any) {
          callOrder.push('afterSave')
        }
        override beforeDelete(_record: any) {
          callOrder.push('beforeDelete')
        }
        override afterDelete(_record: any) {
          callOrder.push('afterDelete')
        }
      }
      ItemResource.model = ItemModel

      const ctrl = makeController(ItemResource)

      // Create
      const createReq = mockRequest({
        method: 'POST',
        path: '/admin/api/resources/items',
        body: { name: 'Lifecycle Item', status: 'draft' },
      })
      const createRes = await ctrl.store(createReq)
      const createJson = await parseJson(createRes)
      const newId = createJson.data.id

      // Update
      const updateReq = mockRequest({
        method: 'PUT',
        path: `/admin/api/resources/items/${newId}`,
        body: { name: 'Updated Lifecycle Item' },
      })
      await ctrl.update(updateReq)

      // Delete
      const deleteReq = mockRequest({
        method: 'DELETE',
        path: `/admin/api/resources/items/${newId}`,
      })
      await ctrl.destroy(deleteReq)

      expect(callOrder).toEqual([
        'beforeCreate',
        'afterCreate',
        'beforeSave',
        'afterSave',
        'beforeDelete',
        'afterDelete',
      ])
    })
  })
})
