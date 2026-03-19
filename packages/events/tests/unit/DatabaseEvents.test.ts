import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { Dispatcher } from '../../src/Dispatcher.ts'
import { QueryExecuted, TransactionBeginning, TransactionCommitted, TransactionRolledBack } from '@mantiq/database'

describe('Database Events', () => {
  let dispatcher: Dispatcher
  let conn: SQLiteConnection

  beforeEach(() => {
    dispatcher = new Dispatcher()
    SQLiteConnection._dispatcher = dispatcher
    conn = new SQLiteConnection({ database: ':memory:' })
  })

  afterEach(() => {
    SQLiteConnection._dispatcher = null
    conn.close()
  })

  it('fires QueryExecuted on select()', async () => {
    const events: QueryExecuted[] = []
    dispatcher.on(QueryExecuted, (e) => { events.push(e as QueryExecuted) })

    await conn.statement('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
    await conn.select('SELECT * FROM test')

    // Two events: one for CREATE TABLE, one for SELECT
    expect(events).toHaveLength(2)
    expect(events[1].sql).toBe('SELECT * FROM test')
    expect(events[1].connectionName).toBe('sqlite')
    expect(events[1].time).toBeGreaterThanOrEqual(0)
  })

  it('fires QueryExecuted on statement()', async () => {
    const events: QueryExecuted[] = []
    dispatcher.on(QueryExecuted, (e) => { events.push(e as QueryExecuted) })

    await conn.statement('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')

    expect(events).toHaveLength(1)
    expect(events[0].sql).toContain('CREATE TABLE')
  })

  it('fires QueryExecuted on insertGetId()', async () => {
    await conn.statement('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')

    const events: QueryExecuted[] = []
    dispatcher.on(QueryExecuted, (e) => { events.push(e as QueryExecuted) })

    const id = await conn.insertGetId('INSERT INTO test (name) VALUES (?)', ['Alice'])

    expect(id).toBe(1)
    expect(events).toHaveLength(1)
    expect(events[0].sql).toContain('INSERT')
    expect(events[0].bindings).toEqual(['Alice'])
  })

  it('fires transaction events on commit', async () => {
    await conn.statement('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')

    const beginEvents: TransactionBeginning[] = []
    const commitEvents: TransactionCommitted[] = []
    dispatcher.on(TransactionBeginning, (e) => { beginEvents.push(e as TransactionBeginning) })
    dispatcher.on(TransactionCommitted, (e) => { commitEvents.push(e as TransactionCommitted) })

    await conn.transaction(async (c) => {
      await c.statement('INSERT INTO test (name) VALUES (?)', ['Bob'])
    })

    expect(beginEvents).toHaveLength(1)
    expect(commitEvents).toHaveLength(1)
    expect(beginEvents[0].connectionName).toBe('sqlite')
  })

  it('fires TransactionRolledBack on error', async () => {
    await conn.statement('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')

    const rollbackEvents: TransactionRolledBack[] = []
    dispatcher.on(TransactionRolledBack, (e) => { rollbackEvents.push(e as TransactionRolledBack) })

    try {
      await conn.transaction(async () => {
        throw new Error('test failure')
      })
    } catch {
      // Expected
    }

    expect(rollbackEvents).toHaveLength(1)
  })

  it('does not fire events when dispatcher is null', async () => {
    SQLiteConnection._dispatcher = null
    // Should not throw
    await conn.statement('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
    await conn.select('SELECT * FROM test')
  })
})
