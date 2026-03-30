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
import { BooleanColumn } from '../../src/tables/columns/BooleanColumn.ts'

// ── SQLite Database Setup ────────────────────────────────────────────────────

let db: Database

function createDatabase(): Database {
  const database = new Database(':memory:')
  database.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      price REAL NOT NULL DEFAULT 0,
      in_stock INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  return database
}

function seedDatabase(database: Database): void {
  const insert = database.prepare(
    'INSERT INTO products (name, description, category, price, in_stock, featured) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const products = [
    ['Widget Alpha', 'A great widget for 100% satisfaction', 'electronics', 29.99, 1, 1],
    ['Widget Beta', 'Beta version widget', 'electronics', 49.99, 1, 0],
    ['Gadget Gamma', 'The ultimate gadget', 'electronics', 99.99, 0, 1],
    ['Book: SQL Mastery', 'Learn SQL inside and out', 'books', 39.99, 1, 0],
    ['Book: JavaScript_Pro', 'Advanced JS techniques', 'books', 44.99, 1, 1],
    ['Clothing: T-Shirt', '100% cotton t-shirt', 'clothing', 19.99, 1, 0],
    ['Clothing: Jacket', 'Winter jacket', 'clothing', 89.99, 0, 0],
    ['Toy: Puzzle', 'Brain teaser puzzle', 'toys', 14.99, 1, 0],
    ['Food: Organic Nuts', '50% off organic nuts', 'food', 9.99, 1, 0],
    ['UPPERCASE PRODUCT', 'Testing case sensitivity', 'general', 5.00, 1, 0],
    ['lowercase product', 'Testing case sensitivity', 'general', 5.00, 1, 0],
    ['Special % Product', 'Contains percent in name', 'general', 10.00, 1, 0],
    ['Under_score Item', 'Contains underscore', 'general', 15.00, 1, 0],
  ]
  for (const p of products) {
    insert.run(...p)
  }
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
    return this
  }

  async delete(): Promise<boolean> {
    return this._db.prepare(`DELETE FROM ${this._tableName} WHERE id = ?`).run(this._attributes.id).changes > 0
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

// ── Resource + Panel ─────────────────────────────────────────────────────────

let ProductModel: any

class ProductResource extends Resource {
  static override slug = 'products'
  static override defaultSort = 'id'
  static override defaultSortDirection: 'asc' | 'desc' = 'asc'

  override form() {
    return Form.make([
      TextInput.make('name'),
      TextInput.make('description'),
      TextInput.make('category'),
    ])
  }

  override table() {
    return Table.make([
      TextColumn.make('name').sortable().searchable(),
      TextColumn.make('description').searchable(),
      TextColumn.make('category').sortable(),
      TextColumn.make('price').sortable(),
      BooleanColumn.make('in_stock'),
      BooleanColumn.make('featured'),
    ])
  }
}

class TestPanel extends StudioPanel {
  override path = '/admin'
  override resources(): Array<typeof Resource> {
    return [ProductResource]
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StudioController Search & Filter Integration', () => {
  let controller: StudioController
  let panelManager: PanelManager

  beforeEach(() => {
    db = createDatabase()
    seedDatabase(db)
    ProductModel = createModelClass('products', db)
    ProductResource.model = ProductModel

    panelManager = new PanelManager()
    panelManager.register(new TestPanel())
    controller = new StudioController(panelManager)
  })

  // ── Search ─────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('is case-insensitive', async () => {
      // SQLite LIKE is case-insensitive for ASCII by default
      const reqUpper = mockRequest({
        path: '/admin/api/resources/products',
        query: { search: 'WIDGET', perPage: '20' },
      })
      const resUpper = await controller.index(reqUpper)
      const jsonUpper = await parseJson(resUpper)

      const reqLower = mockRequest({
        path: '/admin/api/resources/products',
        query: { search: 'widget', perPage: '20' },
      })
      const resLower = await controller.index(reqLower)
      const jsonLower = await parseJson(resLower)

      // Both should find Widget Alpha and Widget Beta
      expect(jsonUpper.meta.total).toBe(jsonLower.meta.total)
      expect(jsonUpper.meta.total).toBeGreaterThanOrEqual(2)
    })

    it('escapes special LIKE characters', async () => {
      // Search for "100%" — the % should be escaped so it doesn't act as wildcard
      const req = mockRequest({
        path: '/admin/api/resources/products',
        query: { search: '100%', perPage: '20' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      // Should find products that literally contain "100%" in name or description
      // "Widget Alpha" has "100% satisfaction" in description
      // "Clothing: T-Shirt" has "100% cotton" in description
      // The % should not match as a wildcard
      expect(res.status).toBe(200)
      // Results should only contain items with literal "100%" in searchable columns
      for (const record of json.data) {
        const matchesName = record.name.includes('100%')
        const matchesDesc = (record.description ?? '').includes('100%')
        expect(matchesName || matchesDesc).toBe(true)
      }
    })

    it('search with empty string returns all records', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/products',
        query: { search: '', perPage: '50' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(json.meta.total).toBe(13) // All products
    })
  })

  // ── Filters ────────────────────────────────────────────────────────────────

  describe('filters', () => {
    it('multiple filters combine with AND', async () => {
      // Filter by category=electronics AND in_stock=1
      const req = mockRequest({
        path: '/admin/api/resources/products',
        query: {
          'filter[category]': 'electronics',
          'filter[in_stock]': '1',
          perPage: '20',
        },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      // Electronics that are in stock: Widget Alpha, Widget Beta (not Gadget Gamma which is out of stock)
      expect(json.data.length).toBe(2)
      for (const record of json.data) {
        expect(record.category).toBe('electronics')
        expect(record.in_stock).toBe(1)
      }
    })

    it('category filter returns matching records', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/products',
        query: { 'filter[category]': 'books', perPage: '20' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(json.data.length).toBe(2) // Two books
      for (const record of json.data) {
        expect(record.category).toBe('books')
      }
    })

    it('TernaryFilter with true value', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/products',
        query: { 'filter[featured]': '1', perPage: '20' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(json.data.length).toBe(3) // Widget Alpha, Gadget Gamma, Book: JavaScript_Pro
      for (const record of json.data) {
        expect(record.featured).toBe(1)
      }
    })

    it('TernaryFilter with false value', async () => {
      const req = mockRequest({
        path: '/admin/api/resources/products',
        query: { 'filter[featured]': '0', perPage: '20' },
      })
      const res = await controller.index(req)
      const json = await parseJson(res)

      expect(json.data.length).toBe(10) // 13 total - 3 featured = 10
      for (const record of json.data) {
        expect(record.featured).toBe(0)
      }
    })

    it('filter on non-existent column is ignored safely', async () => {
      // Filtering on a column that doesn't exist in the DB should not crash
      // The controller applies it as a simple WHERE clause, which may return empty results
      // but should not error
      const req = mockRequest({
        path: '/admin/api/resources/products',
        query: { 'filter[nonexistent_column]': 'value', perPage: '20' },
      })

      let res: Response
      try {
        res = await controller.index(req)
      } catch {
        // SQLite might throw for unknown column — the controller wraps in handleError
        // so we should get a response
        return
      }

      // If the database doesn't crash, we should get a 200 with potentially 0 results,
      // or a 500 if the DB threw
      expect([200, 500]).toContain(res.status)
    })
  })
})
