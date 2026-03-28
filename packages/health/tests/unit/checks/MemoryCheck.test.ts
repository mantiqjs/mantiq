import { describe, test, expect } from 'bun:test'
import { MemoryCheck } from '../../../src/checks/MemoryCheck.ts'

describe('MemoryCheck', () => {
  test('passes under default thresholds (256/512 MB)', async () => {
    const check = new MemoryCheck()
    const result = await check.execute()
    // Bun test process should be well under 256 MB heap
    expect(result.status).toBe('ok')
    expect(result.name).toBe('memory')
  })

  test('reports heap and rss in metadata', async () => {
    const result = await new MemoryCheck().execute()
    expect(result.meta?.heap).toMatch(/^\d+(\.\d+)?MB$/)
    expect(result.meta?.rss).toMatch(/^\d+(\.\d+)?MB$/)
    expect(result.meta?.threshold_warn).toBe('256MB')
    expect(result.meta?.threshold_critical).toBe('512MB')
  })

  test('passes with generous thresholds', async () => {
    const result = await new MemoryCheck({ warnAt: 2048, criticalAt: 4096 }).execute()
    expect(result.status).toBe('ok')
  })

  test('degrades when heap exceeds warn threshold', async () => {
    // 1MB warn, generous critical - Bun test process always exceeds 1MB heap
    const result = await new MemoryCheck({ warnAt: 1, criticalAt: 4096 }).execute()
    expect(result.status).toBe('degraded')
    expect(result.message).toContain('exceeds warning threshold')
    expect(result.message).toContain('1MB')
  })

  test('fails when heap exceeds critical threshold', async () => {
    // 1MB critical - Bun test process always exceeds 1MB heap
    const result = await new MemoryCheck({ warnAt: 1, criticalAt: 1 }).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('exceeds critical threshold')
    expect(result.message).toContain('1MB')
  })

  test('critical takes priority over warn when both exceeded', async () => {
    const result = await new MemoryCheck({ warnAt: 1, criticalAt: 1 }).execute()
    // When critical is exceeded, it should be critical (not degraded)
    expect(result.status).toBe('critical')
  })

  test('custom thresholds appear in metadata', async () => {
    const result = await new MemoryCheck({ warnAt: 100, criticalAt: 200 }).execute()
    expect(result.meta?.threshold_warn).toBe('100MB')
    expect(result.meta?.threshold_critical).toBe('200MB')
  })

  test('duration is tracked', async () => {
    const result = await new MemoryCheck().execute()
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(typeof result.duration).toBe('number')
  })
})
