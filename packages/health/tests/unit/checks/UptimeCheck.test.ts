import { describe, test, expect } from 'bun:test'
import { UptimeCheck } from '../../../src/checks/UptimeCheck.ts'

describe('UptimeCheck', () => {
  test('always passes', async () => {
    const result = await new UptimeCheck().execute()
    expect(result.status).toBe('ok')
    expect(result.name).toBe('uptime')
  })

  test('reports seconds in metadata', async () => {
    const result = await new UptimeCheck().execute()
    expect(typeof result.meta?.seconds).toBe('number')
    expect(result.meta?.seconds).toBeGreaterThanOrEqual(0)
  })

  test('reports formatted uptime string', async () => {
    const result = await new UptimeCheck().execute()
    expect(typeof result.meta?.formatted).toBe('string')
    // Should end with 's' (for seconds part)
    expect(result.meta?.formatted).toMatch(/\d+s$/)
  })

  test('reports process PID', async () => {
    const result = await new UptimeCheck().execute()
    expect(result.meta?.pid).toBe(process.pid)
  })

  test('formatted includes hours when uptime is long enough', async () => {
    // We can't easily fake process.uptime(), but we can verify
    // the format pattern is correct for the current uptime
    const result = await new UptimeCheck().execute()
    const seconds = result.meta?.seconds
    const formatted = result.meta?.formatted as string

    if (seconds >= 3600) {
      expect(formatted).toMatch(/\d+h/)
    }
    if (seconds >= 60) {
      expect(formatted).toMatch(/\d+m/)
    }
    // Always has seconds
    expect(formatted).toMatch(/\d+s/)
  })

  test('duration is tracked', async () => {
    const result = await new UptimeCheck().execute()
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(typeof result.duration).toBe('number')
  })

  test('never returns critical or degraded', async () => {
    // Run multiple times to be sure
    for (let i = 0; i < 3; i++) {
      const result = await new UptimeCheck().execute()
      expect(result.status).toBe('ok')
    }
  })
})
