import { describe, test, expect } from 'bun:test'
import { SchedulerCheck } from '../../../src/checks/SchedulerCheck.ts'

describe('SchedulerCheck', () => {
  test('passes with registered tasks', async () => {
    const mockScheduler = {
      events: () => [
        { command: 'prune:sessions' },
        { command: 'queue:work' },
        { command: 'backup:run' },
      ],
    }
    const result = await new SchedulerCheck(mockScheduler).execute()
    expect(result.status).toBe('ok')
    expect(result.name).toBe('scheduler')
    expect(result.meta?.tasks).toBe(3)
  })

  test('degrades when no tasks are registered', async () => {
    const result = await new SchedulerCheck({ events: () => [] }).execute()
    expect(result.status).toBe('degraded')
    expect(result.message).toContain('No scheduled tasks registered')
  })

  test('fails when scheduler instance is null', async () => {
    const result = await new SchedulerCheck(null).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toBe('Scheduler instance is null')
  })

  test('works with tasks property fallback', async () => {
    const mockScheduler = {
      tasks: [
        { command: 'cache:clear' },
      ],
    }
    const result = await new SchedulerCheck(mockScheduler).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.tasks).toBe(1)
  })

  test('reports correct task count for single task', async () => {
    const mockScheduler = {
      events: () => [{ command: 'inspire' }],
    }
    const result = await new SchedulerCheck(mockScheduler).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.tasks).toBe(1)
  })

  test('treats non-array tasks as 0', async () => {
    const mockScheduler = {
      events: () => 'not-an-array',
    }
    const result = await new SchedulerCheck(mockScheduler).execute()
    expect(result.status).toBe('degraded')
    expect(result.meta?.tasks).toBe(0)
  })

  test('duration is tracked', async () => {
    const result = await new SchedulerCheck({ events: () => [] }).execute()
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})
