import { describe, test, expect, mock } from 'bun:test'
import { DatabaseCheck } from '../../../src/checks/DatabaseCheck.ts'

describe('DatabaseCheck', () => {
  test('passes when SQL SELECT 1 succeeds', async () => {
    const conn = {
      getDriverName: () => 'postgres',
      select: mock(async () => [{ '?column?': 1 }]),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('ok')
    expect(result.name).toBe('database')
    expect(result.meta?.driver).toBe('postgres')
    expect(result.meta?.latency).toMatch(/^\d+ms$/)
    expect(conn.select).toHaveBeenCalledWith('SELECT 1')
  })

  test('reports mysql driver name', async () => {
    const conn = {
      getDriverName: () => 'mysql',
      select: mock(async () => [{ 1: 1 }]),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('mysql')
  })

  test('fails when SELECT 1 throws', async () => {
    const conn = {
      getDriverName: () => 'postgres',
      select: mock(async () => { throw new Error('Connection refused') }),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toBe('Connection refused')
  })

  test('fails with wrong credentials error message', async () => {
    const conn = {
      getDriverName: () => 'mysql',
      select: mock(async () => { throw new Error('Access denied for user \'root\'@\'localhost\'') }),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Access denied')
  })

  test('reports latency metadata on success', async () => {
    const conn = {
      getDriverName: () => 'sqlite',
      select: mock(async () => {
        // Simulate a tiny delay
        await new Promise((r) => setTimeout(r, 5))
        return [{ 1: 1 }]
      }),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.latency).toBeDefined()
  })

  test('falls back to "unknown" when getDriverName is missing', async () => {
    const conn = {
      select: mock(async () => []),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('unknown')
  })

  test('handles MongoDB connection with ping', async () => {
    const nativeDb = { command: mock(async () => ({ ok: 1 })) }
    const conn = {
      getDriverName: () => 'mongodb',
      native: mock(async () => nativeDb),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('mongodb')
    expect(nativeDb.command).toHaveBeenCalledWith({ ping: 1 })
  })

  test('fails when MongoDB native() returns null', async () => {
    const conn = {
      getDriverName: () => 'mongodb',
      native: mock(async () => null),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Cannot access native MongoDB connection')
  })

  test('fails when MongoDB ping throws', async () => {
    const nativeDb = { command: mock(async () => { throw new Error('MongoServerError: not primary') }) }
    const conn = {
      getDriverName: () => 'mongodb',
      native: mock(async () => nativeDb),
    }
    const result = await new DatabaseCheck(conn).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('MongoServerError')
  })
})
