import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { MongoConnection } from '../../src/drivers/MongoConnection.ts'
import type { QueryState, WhereClause } from '../../src/query/Builder.ts'

// ── Mock helpers ────────────────────────────────────────────────────────────

function emptyState(table: string, overrides: Partial<QueryState> = {}): QueryState {
  return {
    table,
    columns: ['*'],
    distinct: false,
    wheres: [],
    joins: [],
    orders: [],
    groups: [],
    havings: [],
    limitValue: null,
    offsetValue: null,
    ...overrides,
  }
}

/**
 * Creates a MongoConnection with a mocked getDb that returns a mock database.
 * Bypasses the actual mongodb driver dependency.
 */
function mockMongoConnection(mockDb: any): MongoConnection {
  const conn = new MongoConnection({ uri: 'mongodb://localhost:27017', database: 'testdb' })
  // Inject mock db and client to skip real connection
  ;(conn as any).db = mockDb
  ;(conn as any).client = {
    connect: mock(async () => {}),
    close: mock(async () => {}),
    startSession: mock(() => ({
      withTransaction: mock(async (fn: any) => fn()),
      endSession: mock(async () => {}),
    })),
  }
  return conn
}

function createMockCollection(overrides: Record<string, any> = {}) {
  const mockCursor = {
    project: mock(function(this: any) { return this }),
    sort: mock(function(this: any) { return this }),
    skip: mock(function(this: any) { return this }),
    limit: mock(function(this: any) { return this }),
    toArray: mock(async () => overrides.findResult ?? []),
  }

  return {
    find: mock(() => mockCursor),
    findOne: mock(async () => overrides.findOneResult ?? null),
    insertOne: mock(async () => overrides.insertOneResult ?? { acknowledged: true, insertedId: 'abc123' }),
    insertMany: mock(async () => overrides.insertManyResult ?? { acknowledged: true, insertedIds: { 0: 'a', 1: 'b' }, insertedCount: 2 }),
    updateOne: mock(async () => overrides.updateOneResult ?? { acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
    updateMany: mock(async () => overrides.updateManyResult ?? { acknowledged: true, matchedCount: 3, modifiedCount: 3 }),
    deleteOne: mock(async () => overrides.deleteOneResult ?? { acknowledged: true, deletedCount: 1 }),
    deleteMany: mock(async () => overrides.deleteManyResult ?? { acknowledged: true, deletedCount: 5 }),
    countDocuments: mock(async () => overrides.countResult ?? 42),
    aggregate: mock(() => ({
      toArray: mock(async () => overrides.aggregateResult ?? [{ result: 100 }]),
    })),
    createIndex: mock(async () => overrides.indexName ?? 'email_1'),
    drop: mock(async () => true),
    _cursor: mockCursor,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MongoConnection', () => {
  let mockCol: ReturnType<typeof createMockCollection>
  let mockDb: any
  let conn: MongoConnection

  beforeEach(() => {
    mockCol = createMockCollection()
    mockDb = {
      collection: mock(() => mockCol),
      command: mock(async () => ({ ok: 1 })),
      listCollections: mock(() => ({
        toArray: mock(async () => [{ name: 'users' }, { name: 'posts' }]),
      })),
    }
    conn = mockMongoConnection(mockDb)
  })

  // ── Connection lifecycle ──────────────────────────────────────────────

  test('getDriverName returns "mongodb"', () => {
    expect(conn.getDriverName()).toBe('mongodb')
  })

  test('getTablePrefix returns empty string', () => {
    expect(conn.getTablePrefix()).toBe('')
  })

  test('disconnect closes client and clears references', async () => {
    await conn.disconnect()
    expect((conn as any).client).toBeNull()
    expect((conn as any).db).toBeNull()
  })

  test('connection error wraps in ConnectionError', async () => {
    const badConn = new MongoConnection({ uri: 'mongodb://invalid:27017', database: 'testdb' })
    // Force getDb to fail by not mocking it - the import('mongodb') will fail
    await expect(badConn.executeSelect(emptyState('users'))).rejects.toThrow()
  })

  // ── executeSelect ─────────────────────────────────────────────────────

  test('executeSelect with no wheres calls find with empty filter', async () => {
    await conn.executeSelect(emptyState('users'))
    expect(mockDb.collection).toHaveBeenCalledWith('users')
    expect(mockCol.find).toHaveBeenCalledWith({})
  })

  test('executeSelect returns documents from cursor.toArray', async () => {
    const docs = [{ _id: '1', name: 'Alice' }, { _id: '2', name: 'Bob' }]
    mockCol._cursor.toArray = mock(async () => docs)

    const result = await conn.executeSelect(emptyState('users'))
    expect(result).toEqual(docs)
  })

  test('executeSelect applies limit and offset', async () => {
    await conn.executeSelect(emptyState('users', { limitValue: 10, offsetValue: 20 }))
    expect(mockCol._cursor.skip).toHaveBeenCalledWith(20)
    expect(mockCol._cursor.limit).toHaveBeenCalledWith(10)
  })

  test('executeSelect applies orderBy as sort document', async () => {
    await conn.executeSelect(emptyState('users', {
      orders: [
        { column: 'name', direction: 'asc' },
        { column: 'created_at', direction: 'desc' },
      ],
    }))
    expect(mockCol._cursor.sort).toHaveBeenCalledWith({ name: 1, created_at: -1 })
  })

  test('executeSelect applies column projection', async () => {
    await conn.executeSelect(emptyState('users', { columns: ['name', 'email'] }))
    expect(mockCol._cursor.project).toHaveBeenCalledWith({ name: 1, email: 1 })
  })

  test('executeSelect with * columns skips projection', async () => {
    await conn.executeSelect(emptyState('users', { columns: ['*'] }))
    expect(mockCol._cursor.project).not.toHaveBeenCalled()
  })

  test('executeSelect throws on joins', async () => {
    await expect(conn.executeSelect(emptyState('users', {
      joins: [{ type: 'inner', table: 'posts', first: 'users.id', operator: '=', second: 'posts.user_id' }],
    }))).rejects.toThrow('not supported')
  })

  test('executeSelect throws on havings', async () => {
    await expect(conn.executeSelect(emptyState('users', {
      havings: [{ type: 'basic', boolean: 'and', column: 'total', operator: '>', value: 100 }],
    }))).rejects.toThrow('not supported')
  })

  // ── executeInsert ─────────────────────────────────────────────────────

  test('executeInsert calls insertOne and returns 1 on success', async () => {
    const result = await conn.executeInsert('users', { name: 'Alice', age: 30 })
    expect(result).toBe(1)
    expect(mockCol.insertOne).toHaveBeenCalledWith({ name: 'Alice', age: 30 })
  })

  test('executeInsert returns 0 when not acknowledged', async () => {
    mockCol.insertOne = mock(async () => ({ acknowledged: false, insertedId: null }))
    const result = await conn.executeInsert('users', { name: 'Bob' })
    expect(result).toBe(0)
  })

  // ── executeInsertGetId ────────────────────────────────────────────────

  test('executeInsertGetId returns inserted id as string for ObjectId', async () => {
    mockCol.insertOne = mock(async () => ({
      acknowledged: true,
      insertedId: { toString: () => '64a7b8c9d1e2f3a4b5c6d7e8' },
    }))
    const id = await conn.executeInsertGetId('users', { name: 'Charlie' })
    expect(id).toBe('64a7b8c9d1e2f3a4b5c6d7e8')
  })

  test('executeInsertGetId returns numeric id when not an object', async () => {
    mockCol.insertOne = mock(async () => ({
      acknowledged: true,
      insertedId: 42,
    }))
    const id = await conn.executeInsertGetId('users', { name: 'Numeric' })
    expect(id).toBe(42)
  })

  // ── executeUpdate ─────────────────────────────────────────────────────

  test('executeUpdate calls updateMany with $set and returns modifiedCount', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'basic', boolean: 'and', column: 'id', operator: '=', value: 1 }],
    })
    const result = await conn.executeUpdate('users', state, { name: 'Updated' })
    expect(result).toBe(3) // from mock default
    expect(mockCol.updateMany).toHaveBeenCalledWith({ id: 1 }, { $set: { name: 'Updated' } })
  })

  // ── executeDelete ─────────────────────────────────────────────────────

  test('executeDelete calls deleteMany and returns deletedCount', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'basic', boolean: 'and', column: 'active', operator: '=', value: false }],
    })
    const result = await conn.executeDelete('users', state)
    expect(result).toBe(5) // from mock default
    expect(mockCol.deleteMany).toHaveBeenCalledWith({ active: false })
  })

  // ── executeTruncate ───────────────────────────────────────────────────

  test('executeTruncate calls deleteMany with empty filter', async () => {
    await conn.executeTruncate('users')
    expect(mockCol.deleteMany).toHaveBeenCalledWith({})
  })

  // ── executeAggregate ──────────────────────────────────────────────────

  test('executeAggregate with count calls countDocuments', async () => {
    const result = await conn.executeAggregate(emptyState('users'), 'count', '*')
    expect(result).toBe(42) // from mock default
    expect(mockCol.countDocuments).toHaveBeenCalledWith({})
  })

  test('executeAggregate with sum runs aggregation pipeline', async () => {
    const result = await conn.executeAggregate(emptyState('orders'), 'sum', 'amount')
    expect(result).toBe(100)
    const pipeline = (mockCol.aggregate.mock.calls as any[])[0]?.[0]
    expect(pipeline?.[0]).toEqual({ $match: {} })
    expect(pipeline?.[1]?.$group?._id).toBeNull()
    expect(pipeline?.[1]?.$group?.result?.$sum).toBe('$amount')
  })

  // ── executeExists ─────────────────────────────────────────────────────

  test('executeExists returns true when documents match', async () => {
    mockCol.countDocuments = mock(async () => 1)
    const result = await conn.executeExists(emptyState('users'))
    expect(result).toBe(true)
  })

  test('executeExists returns false when no documents match', async () => {
    mockCol.countDocuments = mock(async () => 0)
    const result = await conn.executeExists(emptyState('users'))
    expect(result).toBe(false)
  })

  // ── Where clause translation ──────────────────────────────────────────

  test('where with = operator translates to simple equality filter', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'basic', boolean: 'and', column: 'name', operator: '=', value: 'Alice' }],
    })
    await conn.executeSelect(state)
    expect(mockCol.find).toHaveBeenCalledWith({ name: 'Alice' })
  })

  test('where with > operator translates to $gt', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'basic', boolean: 'and', column: 'age', operator: '>', value: 18 }],
    })
    await conn.executeSelect(state)
    expect(mockCol.find).toHaveBeenCalledWith({ age: { $gt: 18 } })
  })

  test('where with != operator translates to $ne', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'basic', boolean: 'and', column: 'status', operator: '!=', value: 'banned' }],
    })
    await conn.executeSelect(state)
    expect(mockCol.find).toHaveBeenCalledWith({ status: { $ne: 'banned' } })
  })

  test('whereIn translates to $in', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'in', boolean: 'and', column: 'id', values: [1, 2, 3] }],
    })
    await conn.executeSelect(state)
    expect(mockCol.find).toHaveBeenCalledWith({ id: { $in: [1, 2, 3] } })
  })

  test('whereNotIn translates to $nin', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'notIn', boolean: 'and', column: 'id', values: [4, 5] }],
    })
    await conn.executeSelect(state)
    expect(mockCol.find).toHaveBeenCalledWith({ id: { $nin: [4, 5] } })
  })

  test('whereNull translates to null equality', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'null', boolean: 'and', column: 'deleted_at' }],
    })
    await conn.executeSelect(state)
    expect(mockCol.find).toHaveBeenCalledWith({ deleted_at: null })
  })

  test('whereNotNull translates to $ne: null', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'notNull', boolean: 'and', column: 'email' }],
    })
    await conn.executeSelect(state)
    expect(mockCol.find).toHaveBeenCalledWith({ email: { $ne: null } })
  })

  test('whereBetween translates to $gte and $lte', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'between', boolean: 'and', column: 'age', range: [18, 65] }],
    })
    await conn.executeSelect(state)
    expect(mockCol.find).toHaveBeenCalledWith({ age: { $gte: 18, $lte: 65 } })
  })

  test('multiple AND wheres produce $and filter', async () => {
    const state = emptyState('users', {
      wheres: [
        { type: 'basic', boolean: 'and', column: 'active', operator: '=', value: true },
        { type: 'basic', boolean: 'and', column: 'age', operator: '>=', value: 18 },
      ],
    })
    await conn.executeSelect(state)
    const filter = (mockCol.find.mock.calls as any[])[0]?.[0]
    expect(filter.$and).toBeDefined()
    expect(filter.$and[0]).toEqual({ active: true })
    expect(filter.$and[1]).toEqual({ age: { $gte: 18 } })
  })

  test('OR wheres produce $or filter', async () => {
    const state = emptyState('users', {
      wheres: [
        { type: 'basic', boolean: 'and', column: 'role', operator: '=', value: 'admin' },
        { type: 'basic', boolean: 'or', column: 'role', operator: '=', value: 'superadmin' },
      ],
    })
    await conn.executeSelect(state)
    const filter = (mockCol.find.mock.calls as any[])[0]?.[0]
    expect(filter.$or).toBeDefined()
  })

  test('whereRaw throws DriverNotSupportedError', async () => {
    const state = emptyState('users', {
      wheres: [{ type: 'raw', boolean: 'and', sql: 'id > 5' }],
    })
    await expect(conn.executeSelect(state)).rejects.toThrow('not supported')
  })

  // ── Raw SQL methods throw ─────────────────────────────────────────────

  test('select() raw SQL throws DriverNotSupportedError', async () => {
    await expect(conn.select('SELECT * FROM users')).rejects.toThrow('not supported')
  })

  test('statement() raw SQL throws DriverNotSupportedError', async () => {
    await expect(conn.statement('DELETE FROM users')).rejects.toThrow('not supported')
  })

  // ── schema() throws ───────────────────────────────────────────────────

  test('schema() throws DriverNotSupportedError', () => {
    expect(() => conn.schema()).toThrow('not supported')
  })

  // ── Native methods ────────────────────────────────────────────────────

  test('listCollections returns collection names', async () => {
    const names = await conn.listCollections()
    expect(names).toEqual(['users', 'posts'])
  })

  test('command forwards to db.command', async () => {
    const result = await conn.command({ ping: 1 })
    expect(result).toEqual({ ok: 1 })
    expect(mockDb.command).toHaveBeenCalledWith({ ping: 1 })
  })

  test('table() returns a QueryBuilder', () => {
    const builder = conn.table('users')
    expect(builder).toBeDefined()
    expect(typeof builder.where).toBe('function')
    expect(typeof builder.get).toBe('function')
  })

  test('native() returns the db instance', async () => {
    const db = await conn.native()
    expect(db).toBe(mockDb)
  })

  // ── Transaction ───────────────────────────────────────────────────────

  test('transaction creates session and calls callback', async () => {
    const result = await conn.transaction(async (txConn) => {
      expect(txConn.getDriverName()).toBe('mongodb')
      return 'committed'
    })
    expect(result).toBe('committed')
  })
})
