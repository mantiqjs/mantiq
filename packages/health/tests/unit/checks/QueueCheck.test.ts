import { describe, test, expect, mock } from 'bun:test'
import { QueueCheck } from '../../../src/checks/QueueCheck.ts'

describe('QueueCheck', () => {
  test('passes with empty queue', async () => {
    const mockQueue = {
      getDefaultDriver: () => 'sync',
      size: mock(async () => 0),
    }
    const result = await new QueueCheck(mockQueue).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('sync')
    expect(result.meta?.pending).toBe(0)
  })

  test('passes and reports pending job count', async () => {
    const mockQueue = {
      getDefaultDriver: () => 'redis',
      size: mock(async () => 42),
    }
    const result = await new QueueCheck(mockQueue).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.pending).toBe(42)
    expect(result.meta?.driver).toBe('redis')
  })

  test('fails when queue instance is null', async () => {
    const result = await new QueueCheck(null).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toBe('Queue instance is null')
  })

  test('fails when size() throws (worker unreachable)', async () => {
    const mockQueue = {
      getDefaultDriver: () => 'redis',
      size: mock(async () => { throw new Error('ECONNREFUSED 127.0.0.1:6379') }),
    }
    const result = await new QueueCheck(mockQueue).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Queue driver not accessible')
    expect(result.message).toContain('ECONNREFUSED')
  })

  test('reports pending as 0 when size is undefined', async () => {
    const mockQueue = {
      getDefaultDriver: () => 'database',
      // size method missing entirely
    }
    const result = await new QueueCheck(mockQueue).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.pending).toBe(0)
  })

  test('falls back to "unknown" when getDefaultDriver is missing', async () => {
    const mockQueue = {
      size: mock(async () => 3),
    }
    const result = await new QueueCheck(mockQueue).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('unknown')
  })

  test('calls size with "default" queue name', async () => {
    const sizeMock = mock(async (_name: string) => 10)
    const mockQueue = {
      getDefaultDriver: () => 'sqs',
      size: sizeMock,
    }
    await new QueueCheck(mockQueue).execute()
    expect(sizeMock).toHaveBeenCalledWith('default')
  })
})
