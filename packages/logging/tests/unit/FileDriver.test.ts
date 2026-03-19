import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { FileDriver } from '../../src/drivers/FileDriver.ts'

let testDir: string

beforeEach(() => {
  testDir = join(tmpdir(), `mantiq-log-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('FileDriver', () => {
  it('writes log entries to a file', async () => {
    const logPath = join(testDir, 'app.log')
    const driver = new FileDriver('app', logPath)

    driver.info('server started')
    driver.error('something broke', { code: 500 })

    // Wait for fire-and-forget writes
    await new Promise((r) => setTimeout(r, 100))

    const content = await Bun.file(logPath).text()
    expect(content).toContain('server started')
    expect(content).toContain('something broke')
    expect(content).toContain('"code":500')
    expect(content).toContain('INFO')
    expect(content).toContain('ERROR')
  })

  it('creates parent directories automatically', async () => {
    const logPath = join(testDir, 'deep', 'nested', 'dir', 'app.log')
    const driver = new FileDriver('app', logPath)

    driver.info('test')
    await new Promise((r) => setTimeout(r, 100))

    expect(await Bun.file(logPath).exists()).toBe(true)
  })

  it('appends to existing file', async () => {
    const logPath = join(testDir, 'append.log')
    const driver = new FileDriver('app', logPath)

    driver.info('first')
    await new Promise((r) => setTimeout(r, 50))
    driver.info('second')
    await new Promise((r) => setTimeout(r, 100))

    const content = await Bun.file(logPath).text()
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('first')
    expect(lines[1]).toContain('second')
  })

  it('respects minimum log level', async () => {
    const logPath = join(testDir, 'level.log')
    const driver = new FileDriver('app', logPath, 'error')

    driver.debug('ignored')
    driver.info('ignored')
    driver.warning('ignored')
    driver.error('kept')
    driver.critical('kept')

    await new Promise((r) => setTimeout(r, 100))

    const content = await Bun.file(logPath).text()
    expect(content).not.toContain('ignored')
    expect(content).toContain('kept')
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(2)
  })
})
