import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { MongoQueryBuilderImpl } from '../../src/drivers/MongoQueryBuilderImpl.ts'

// ── Mock helpers ────────────────────────────────────────────────────────────

function createBuilder(
  docs: Record<string, any>[] = [],
  countValue = 0,
) {
  const executorMock = mock(async (opts: any) => docs)
  const counterMock = mock(async (filter: any) => countValue)

  const builder = new MongoQueryBuilderImpl('users', executorMock, counterMock)
  return { builder, executorMock, counterMock }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MongoQueryBuilderImpl', () => {
  // ── where ─────────────────────────────────────────────────────────────

  test('where() sets filter with $eq semantics', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.where({ name: 'Alice' }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ name: 'Alice' })
  })

  test('where() with $gt operator generates correct filter', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.where({ age: { $gt: 18 } }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ age: { $gt: 18 } })
  })

  test('where() with $lt operator generates correct filter', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.where({ price: { $lt: 100 } }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ price: { $lt: 100 } })
  })

  test('where() with $in operator generates correct filter', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.where({ status: { $in: ['active', 'pending'] } }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ status: { $in: ['active', 'pending'] } })
  })

  test('where() with $ne operator generates correct filter', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.where({ role: { $ne: 'banned' } }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ role: { $ne: 'banned' } })
  })

  test('chained where() merges filters', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.where({ name: 'Alice' }).where({ age: 30 }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ name: 'Alice', age: 30 })
  })

  test('nested dot-notation queries pass through correctly', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.where({ 'address.city': 'New York' }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ 'address.city': 'New York' })
  })

  // ── select (projection) ───────────────────────────────────────────────

  test('select() sets projection with included fields', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.select({ name: 1, email: 1 }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.projection).toEqual({ name: 1, email: 1 })
  })

  test('select() sets projection with excluded fields', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.select({ password: 0 }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.projection).toEqual({ password: 0 })
  })

  // ── sort ──────────────────────────────────────────────────────────────

  test('sort() ascending generates { field: 1 }', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.sort({ name: 1 }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.sort).toEqual({ name: 1 })
  })

  test('sort() descending generates { field: -1 }', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.sort({ created_at: -1 }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.sort).toEqual({ created_at: -1 })
  })

  test('sort() with multiple fields', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.sort({ priority: -1, name: 1 }).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.sort).toEqual({ priority: -1, name: 1 })
  })

  // ── limit / skip ─────────────────────────────────────────────────────

  test('limit() sets correct limit option', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.limit(10).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.limit).toBe(10)
  })

  test('skip() sets correct skip option', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.skip(20).get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.skip).toBe(20)
  })

  // ── get ───────────────────────────────────────────────────────────────

  test('get() returns all matching documents', async () => {
    const docs = [{ _id: '1', name: 'Alice' }, { _id: '2', name: 'Bob' }]
    const { builder } = createBuilder(docs)

    const result = await builder.get()
    expect(result).toEqual(docs)
  })

  test('get() with no results returns empty array', async () => {
    const { builder } = createBuilder([])
    const result = await builder.get()
    expect(result).toEqual([])
  })

  // ── first ─────────────────────────────────────────────────────────────

  test('first() returns first document', async () => {
    const docs = [{ _id: '1', name: 'Alice' }, { _id: '2', name: 'Bob' }]
    const { builder } = createBuilder(docs)

    const result = await builder.first()
    expect(result).toEqual({ _id: '1', name: 'Alice' })
  })

  test('first() returns null when no documents found', async () => {
    const { builder } = createBuilder([])
    const result = await builder.first()
    expect(result).toBeNull()
  })

  // ── firstOrFail ───────────────────────────────────────────────────────

  test('firstOrFail() returns first document when found', async () => {
    const { builder } = createBuilder([{ _id: '1', name: 'Alice' }])
    const result = await builder.firstOrFail()
    expect(result).toEqual({ _id: '1', name: 'Alice' })
  })

  test('firstOrFail() throws ModelNotFoundError when empty', async () => {
    const { builder } = createBuilder([])
    await expect(builder.firstOrFail()).rejects.toThrow('users')
  })

  // ── count ─────────────────────────────────────────────────────────────

  test('count() calls counter with current filter', async () => {
    const { builder, counterMock } = createBuilder([], 42)
    builder.where({ active: true })
    const result = await builder.count()

    expect(result).toBe(42)
    expect(counterMock).toHaveBeenCalledWith({ active: true })
  })

  test('count() with no filter passes empty object', async () => {
    const { builder, counterMock } = createBuilder([], 100)
    const result = await builder.count()

    expect(result).toBe(100)
    expect(counterMock).toHaveBeenCalledWith({})
  })

  // ── Chaining ──────────────────────────────────────────────────────────

  test('chaining where().sort().limit() passes all options', async () => {
    const { builder, executorMock } = createBuilder()
    await builder
      .where({ active: true })
      .sort({ created_at: -1 })
      .limit(5)
      .get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ active: true })
    expect(opts.sort).toEqual({ created_at: -1 })
    expect(opts.limit).toBe(5)
  })

  test('chaining where().select().skip().limit() passes all options', async () => {
    const { builder, executorMock } = createBuilder()
    await builder
      .where({ role: 'admin' })
      .select({ name: 1, email: 1 })
      .skip(10)
      .limit(5)
      .get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({ role: 'admin' })
    expect(opts.projection).toEqual({ name: 1, email: 1 })
    expect(opts.skip).toBe(10)
    expect(opts.limit).toBe(5)
  })

  test('methods return this for fluent chaining', () => {
    const { builder } = createBuilder()
    const result = builder.where({ a: 1 }).select({ a: 1 }).sort({ a: 1 }).limit(1).skip(0)
    expect(result).toBe(builder)
  })

  // ── Default state ─────────────────────────────────────────────────────

  test('default filter is empty object', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.filter).toEqual({})
  })

  test('default projection is undefined', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.projection).toBeUndefined()
  })

  test('default sort is undefined', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.sort).toBeUndefined()
  })

  test('default limit is undefined', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.limit).toBeUndefined()
  })

  test('default skip is undefined', async () => {
    const { builder, executorMock } = createBuilder()
    await builder.get()

    const opts = executorMock.mock.calls[0]![0]
    expect(opts.skip).toBeUndefined()
  })
})
