import { describe, it, expect, beforeEach } from 'bun:test'
import { DatabaseEngine } from '../../src/drivers/DatabaseEngine.ts'
import { SearchBuilder } from '../../src/SearchBuilder.ts'

// ---------------------------------------------------------------------------
// Tracking mock — records all query-builder calls for assertion
// ---------------------------------------------------------------------------

interface QueryCall {
  method: string
  args: any[]
}

function createQueryMock(rows: any[] = [], countValue = 0) {
  const calls: QueryCall[] = []
  const subQueryCalls: QueryCall[] = []

  const queryChain: Record<string, any> = {
    _calls: calls,
    _subQueryCalls: subQueryCalls,

    connection(...args: any[]) {
      calls.push({ method: 'connection', args })
      return queryChain
    },
    where(...args: any[]) {
      // When a callback is provided, invoke it with a sub-query tracker
      if (typeof args[0] === 'function') {
        const subQuery: Record<string, any> = {
          where(...subArgs: any[]) {
            subQueryCalls.push({ method: 'where', args: subArgs })
            return subQuery
          },
          orWhere(...subArgs: any[]) {
            subQueryCalls.push({ method: 'orWhere', args: subArgs })
            return subQuery
          },
          whereRaw(...subArgs: any[]) {
            subQueryCalls.push({ method: 'whereRaw', args: subArgs })
            return subQuery
          },
          orWhereRaw(...subArgs: any[]) {
            subQueryCalls.push({ method: 'orWhereRaw', args: subArgs })
            return subQuery
          },
        }
        args[0](subQuery)
        calls.push({ method: 'where', args: ['<callback>'] })
      } else {
        calls.push({ method: 'where', args })
      }
      return queryChain
    },
    orWhere(...args: any[]) {
      calls.push({ method: 'orWhere', args })
      return queryChain
    },
    whereIn(...args: any[]) {
      calls.push({ method: 'whereIn', args })
      return queryChain
    },
    orderBy(...args: any[]) {
      calls.push({ method: 'orderBy', args })
      return queryChain
    },
    limit(...args: any[]) {
      calls.push({ method: 'limit', args })
      return queryChain
    },
    offset(...args: any[]) {
      calls.push({ method: 'offset', args })
      return queryChain
    },
    async get() {
      calls.push({ method: 'get', args: [] })
      return rows
    },
    async count() {
      calls.push({ method: 'count', args: [] })
      return countValue
    },
  }

  return queryChain
}

// ---------------------------------------------------------------------------
// Model factories
// ---------------------------------------------------------------------------

function createMockModelClass(opts: {
  rows?: any[]
  countValue?: number
  fillable?: string[]
  searchableColumns?: string[]
  primaryKey?: string
  connection?: string
} = {}) {
  const rows = opts.rows ?? []
  const countValue = opts.countValue ?? rows.length
  const allQueries: any[] = []

  const ModelClass: Record<string, any> = {
    table: 'posts',
    primaryKey: opts.primaryKey ?? 'id',
    fillable: opts.fillable ?? ['title', 'body'],
    query() {
      const q = createQueryMock(rows, countValue)
      allQueries.push(q)
      return q
    },
    /** Returns the last query created (most recent call to .query()). */
    getLastQuery() { return allQueries[allQueries.length - 1] },
    /** Returns all query mocks created so far. */
    getAllQueries() { return allQueries },
  }

  if (opts.searchableColumns) {
    ModelClass.searchableColumns = () => opts.searchableColumns!
  }

  return ModelClass
}

function createRow(id: number, attrs: Record<string, any> = {}) {
  return {
    id,
    ...attrs,
    getAttribute(key: string) { return (this as any)[key] },
  }
}

function builderFor(engine: DatabaseEngine, model: any, query: string): SearchBuilder {
  return new SearchBuilder(model, query, engine)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DatabaseEngine', () => {
  let engine: DatabaseEngine

  beforeEach(() => {
    engine = new DatabaseEngine()
  })

  // ── search generates LIKE query ──────────────────────────────────────

  it('search applies LIKE query across searchable columns', async () => {
    const Model = createMockModelClass({ searchableColumns: ['title', 'body'] })
    const b = builderFor(engine, Model, 'hello')

    await engine.search(b)

    const q = Model.getLastQuery()
    // A where callback should have been invoked
    expect(q._calls.some((c: QueryCall) => c.method === 'where')).toBe(true)
    // Sub-query should contain whereRaw LIKE calls with ESCAPE clause
    expect(q._subQueryCalls.length).toBeGreaterThanOrEqual(1)
    expect(q._subQueryCalls[0].method).toBe('whereRaw')
    expect(q._subQueryCalls[0].args).toEqual(["title LIKE ? ESCAPE '\\'", ['%hello%']])
  })

  // ── where clause added to SQL ────────────────────────────────────────

  it('where clause is forwarded to query builder', async () => {
    const Model = createMockModelClass()
    const b = builderFor(engine, Model, '')
    b.where('status', 'published')

    await engine.search(b)

    const q = Model.getLastQuery()
    expect(q._calls).toContainEqual({ method: 'where', args: ['status', 'published'] })
  })

  // ── whereIn generates IN ─────────────────────────────────────────────

  it('whereIn clause is forwarded to query builder', async () => {
    const Model = createMockModelClass()
    const b = builderFor(engine, Model, '')
    b.whereIn('category', ['tech', 'science'])

    await engine.search(b)

    const q = Model.getLastQuery()
    expect(q._calls).toContainEqual({ method: 'whereIn', args: ['category', ['tech', 'science']] })
  })

  // ── orderBy maps to ORDER BY ─────────────────────────────────────────

  it('orderBy is forwarded to query builder', async () => {
    const Model = createMockModelClass()
    const b = builderFor(engine, Model, '')
    b.orderBy('created_at', 'desc')

    await engine.search(b)

    const q = Model.getLastQuery()
    expect(q._calls).toContainEqual({ method: 'orderBy', args: ['created_at', 'desc'] })
  })

  // ── paginate generates LIMIT/OFFSET ──────────────────────────────────

  it('paginate returns total count', async () => {
    const Model = createMockModelClass({ countValue: 25 })
    const b = builderFor(engine, Model, '')

    const result = await engine.paginate(b, 10, 3)

    expect(result.total).toBe(25)
    expect(result.keys).toBeDefined()
  })

  // ── keys() selects only primary key ──────────────────────────────────

  it('keys() returns only the primary key values', async () => {
    const rows = [createRow(1), createRow(2), createRow(3)]
    const Model = createMockModelClass({ rows })
    const b = builderFor(engine, Model, '')

    const result = await engine.search(b)
    expect(result.keys).toEqual([1, 2, 3])
  })

  // ── count() returns total from paginate ──────────────────────────────

  it('paginate returns correct total count', async () => {
    const rows = [createRow(1), createRow(2)]
    const Model = createMockModelClass({ rows, countValue: 50 })
    const b = builderFor(engine, Model, '')

    const result = await engine.paginate(b, 2, 1)
    expect(result.total).toBe(50)
  })

  // ── empty search term returns all ────────────────────────────────────

  it('empty search term returns all rows without LIKE', async () => {
    const rows = [createRow(1), createRow(2)]
    const Model = createMockModelClass({ rows })
    const b = builderFor(engine, Model, '')

    const result = await engine.search(b)

    expect(result.keys).toEqual([1, 2])
    // No sub-query calls for LIKE when query is empty
    const q = Model.getLastQuery()
    expect(q._subQueryCalls.length).toBe(0)
  })

  // ── special characters escaped in LIKE ───────────────────────────────

  it('special characters are escaped in LIKE pattern', async () => {
    const Model = createMockModelClass({ searchableColumns: ['title'] })
    const b = builderFor(engine, Model, '100%_match\\test')

    await engine.search(b)

    const q = Model.getLastQuery()
    // The sub-query should contain escaped LIKE pattern with ESCAPE clause
    expect(q._subQueryCalls[0].method).toBe('whereRaw')
    expect(q._subQueryCalls[0].args[1][0]).toBe('%100\\%\\_match\\\\test%')
  })

  // ── multiple where clauses AND together ──────────────────────────────

  it('multiple where clauses are all applied', async () => {
    const Model = createMockModelClass()
    const b = builderFor(engine, Model, '')
    b.where('status', 'published')
    b.where('type', 'article')

    await engine.search(b)

    const q = Model.getLastQuery()
    const whereCalls = q._calls.filter((c: QueryCall) => c.method === 'where')
    expect(whereCalls.length).toBe(2)
    expect(whereCalls).toContainEqual({ method: 'where', args: ['status', 'published'] })
    expect(whereCalls).toContainEqual({ method: 'where', args: ['type', 'article'] })
  })

  // ── update is no-op ──────────────────────────────────────────────────

  it('update is a no-op (data lives in the database)', async () => {
    // Should not throw
    await engine.update([{ id: 1 }])
  })

  // ── delete is no-op ──────────────────────────────────────────────────

  it('delete is a no-op (data lives in the database)', async () => {
    await engine.delete([{ id: 1 }])
  })

  // ── flush is no-op ───────────────────────────────────────────────────

  it('flush is a no-op (no separate index)', async () => {
    await engine.flush('posts')
  })

  // ── createIndex is no-op ─────────────────────────────────────────────

  it('createIndex is a no-op (database tables are the index)', async () => {
    await engine.createIndex('posts')
  })

  // ── deleteIndex is no-op ─────────────────────────────────────────────

  it('deleteIndex is a no-op', async () => {
    await engine.deleteIndex('posts')
  })

  // ── connection name is forwarded ─────────────────────────────────────

  it('connection name is forwarded to query builder', async () => {
    const engineWithConn = new DatabaseEngine('mysql')
    const Model = createMockModelClass()
    const b = builderFor(engineWithConn, Model, '')

    await engineWithConn.search(b)

    const q = Model.getLastQuery()
    expect(q._calls).toContainEqual({ method: 'connection', args: ['mysql'] })
  })

  // ── custom primaryKey ────────────────────────────────────────────────

  it('uses custom primaryKey from model for keys', async () => {
    const rows = [
      { uuid: 'abc', getAttribute(k: string) { return (this as any)[k] } },
      { uuid: 'def', getAttribute(k: string) { return (this as any)[k] } },
    ]
    const Model = createMockModelClass({ rows, primaryKey: 'uuid' })
    const b = builderFor(engine, Model, '')

    const result = await engine.search(b)
    expect(result.keys).toEqual(['abc', 'def'])
  })

  // ── search with limit via builder ────────────────────────────────────

  it('search forwards limit from builder', async () => {
    const Model = createMockModelClass()
    const b = builderFor(engine, Model, '')
    b.take(5)

    await engine.search(b)

    const q = Model.getLastQuery()
    expect(q._calls).toContainEqual({ method: 'limit', args: [5] })
  })

  // ── search with offset via builder ───────────────────────────────────

  it('search forwards offset from builder', async () => {
    const Model = createMockModelClass()
    const b = builderFor(engine, Model, '')
    b.skip(10)

    await engine.search(b)

    const q = Model.getLastQuery()
    expect(q._calls).toContainEqual({ method: 'offset', args: [10] })
  })

  // ── fallback to fillable columns when searchableColumns not defined ──

  it('falls back to fillable columns when searchableColumns is not defined', async () => {
    const Model = createMockModelClass({ fillable: ['name', 'email'] })
    const b = builderFor(engine, Model, 'john')

    await engine.search(b)

    const q = Model.getLastQuery()
    expect(q._subQueryCalls[0].method).toBe('whereRaw')
    expect(q._subQueryCalls[0].args).toEqual(["name LIKE ? ESCAPE '\\'", ['%john%']])
    if (q._subQueryCalls.length > 1) {
      expect(q._subQueryCalls[1].method).toBe('orWhereRaw')
      expect(q._subQueryCalls[1].args).toEqual(["email LIKE ? ESCAPE '\\'", ['%john%']])
    }
  })
})
