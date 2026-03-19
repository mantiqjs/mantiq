import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { rm, readdir } from 'node:fs/promises'
import { DailyDriver } from '../../src/drivers/DailyDriver.ts'

let testDir: string

beforeEach(() => {
  testDir = join(tmpdir(), `mantiq-daily-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('DailyDriver', () => {
  it('creates a date-stamped log file', async () => {
    const basePath = join(testDir, 'mantiq.log')
    const driver = new DailyDriver('app', basePath)

    driver.info('daily test')
    await new Promise((r) => setTimeout(r, 100))

    const files = await readdir(testDir)
    const today = new Date().toISOString().slice(0, 10)
    const expected = `mantiq-${today}.log`
    expect(files).toContain(expected)

    const content = await Bun.file(join(testDir, expected)).text()
    expect(content).toContain('daily test')
    expect(content).toContain('INFO')
  })

  it('appends to the same file on the same day', async () => {
    const basePath = join(testDir, 'mantiq.log')
    const driver = new DailyDriver('app', basePath)

    driver.info('first')
    await new Promise((r) => setTimeout(r, 50))
    driver.info('second')
    await new Promise((r) => setTimeout(r, 100))

    const today = new Date().toISOString().slice(0, 10)
    const content = await Bun.file(join(testDir, `mantiq-${today}.log`)).text()
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(2)
  })

  it('respects minimum log level', async () => {
    const basePath = join(testDir, 'mantiq.log')
    const driver = new DailyDriver('app', basePath, 'error')

    driver.debug('nope')
    driver.info('nope')
    driver.error('yes')
    await new Promise((r) => setTimeout(r, 100))

    const today = new Date().toISOString().slice(0, 10)
    const content = await Bun.file(join(testDir, `mantiq-${today}.log`)).text()
    expect(content).not.toContain('nope')
    expect(content).toContain('yes')
  })
})
