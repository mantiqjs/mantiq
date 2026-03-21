/**
 * Integration tests for FileDriver and DailyDriver writing to real temp files,
 * plus LogManager with file channel configuration.
 *
 * Run: bun test packages/logging/tests/integration/file-drivers.test.ts
 */
import { describe, test, expect, afterAll, beforeEach } from 'bun:test'
import { join } from 'node:path'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { FileDriver } from '../../src/drivers/FileDriver.ts'
import { DailyDriver } from '../../src/drivers/DailyDriver.ts'
import { LogManager } from '../../src/LogManager.ts'
import { LineFormatter } from '../../src/formatters/LineFormatter.ts'
import { JsonFormatter } from '../../src/formatters/JsonFormatter.ts'

// ── Helpers ─────────────────────────────────────────────────────────────────

let tempDirs: string[] = []

async function makeTempDir(prefix = 'mantiq-log-test-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

/**
 * FileDriver.log() is fire-and-forget (void this.writeLine). We need a short
 * delay to let the async write settle before reading the file.
 */
function settle(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readFile(path: string): Promise<string> {
  const file = Bun.file(path)
  if (!(await file.exists())) return ''
  return file.text()
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

// ── FileDriver ──────────────────────────────────────────────────────────────

describe('FileDriver Integration', () => {
  test('writes a log line to a real file', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'app.log')
    const driver = new FileDriver('test', logPath)

    driver.info('Application started')
    await settle()

    const content = await readFile(logPath)
    expect(content).toContain('Application started')
    expect(content).toContain('INFO')
    expect(content).toContain('test.')
  })

  test('appends multiple log lines', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'multi.log')
    const driver = new FileDriver('app', logPath)

    // Write sequentially with small gaps to avoid fire-and-forget race
    driver.info('First line')
    await settle(150)
    driver.warning('Second line')
    await settle(150)
    driver.error('Third line')
    await settle(150)

    const content = await readFile(logPath)
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(content).toContain('First line')
    expect(content).toContain('Second line')
    expect(content).toContain('Third line')
  })

  test('includes context in log output', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'ctx.log')
    const driver = new FileDriver('app', logPath)

    driver.info('User login', { user_id: 42, ip: '192.168.1.1' })
    await settle()

    const content = await readFile(logPath)
    expect(content).toContain('User login')
    expect(content).toContain('"user_id":42')
    expect(content).toContain('"ip":"192.168.1.1"')
  })

  test('creates parent directories automatically', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'nested', 'deep', 'app.log')
    const driver = new FileDriver('app', logPath)

    driver.info('Nested test')
    await settle()

    const content = await readFile(logPath)
    expect(content).toContain('Nested test')
  })

  test('respects minimum log level', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'level.log')
    // minLevel='warning' means only emergency(0), alert(1), critical(2), error(3), warning(4) are logged
    const driver = new FileDriver('app', logPath, 'warning')

    driver.debug('Should not appear')
    driver.info('Should not appear either')
    driver.warning('Should appear')
    driver.error('Should also appear')
    await settle()

    const content = await readFile(logPath)
    expect(content).not.toContain('Should not appear')
    expect(content).toContain('Should appear')
    expect(content).toContain('Should also appear')
  })

  test('uses JsonFormatter when provided', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'json.log')
    const driver = new FileDriver('app', logPath, 'debug', new JsonFormatter())

    driver.info('JSON test', { key: 'value' })
    await settle()

    const content = await readFile(logPath)
    const parsed = JSON.parse(content.trim())
    expect(parsed.message).toBe('JSON test')
    expect(parsed.level).toBe('info')
    expect(parsed.channel).toBe('app')
    expect(parsed.context.key).toBe('value')
    expect(parsed.timestamp).toBeDefined()
  })

  test('all severity methods write correctly', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'severity.log')
    const driver = new FileDriver('test', logPath)

    driver.emergency('emerg msg')
    driver.alert('alert msg')
    driver.critical('crit msg')
    driver.error('error msg')
    driver.warning('warn msg')
    driver.notice('notice msg')
    driver.info('info msg')
    driver.debug('debug msg')
    await settle()

    const content = await readFile(logPath)
    expect(content).toContain('EMERGENCY')
    expect(content).toContain('ALERT')
    expect(content).toContain('CRITICAL')
    expect(content).toContain('ERROR')
    expect(content).toContain('WARNING')
    expect(content).toContain('NOTICE')
    expect(content).toContain('INFO')
    expect(content).toContain('DEBUG')
  })
})

// ── DailyDriver ─────────────────────────────────────────────────────────────

describe('DailyDriver Integration', () => {
  test('creates date-stamped log file', async () => {
    const dir = await makeTempDir()
    const basePath = join(dir, 'mantiq.log')
    const driver = new DailyDriver('daily', basePath)

    driver.info('Daily log entry')
    await settle()

    const today = new Date().toISOString().slice(0, 10)
    const expectedFile = `mantiq-${today}.log`

    const files = await readdir(dir)
    expect(files).toContain(expectedFile)

    const content = await readFile(join(dir, expectedFile))
    expect(content).toContain('Daily log entry')
    expect(content).toContain('INFO')
  })

  test('appends to same date-stamped file on multiple writes', async () => {
    const dir = await makeTempDir()
    const basePath = join(dir, 'app.log')
    const driver = new DailyDriver('daily', basePath)

    driver.info('Line one')
    await settle(150)
    driver.warning('Line two')
    await settle(150)
    driver.error('Line three')
    await settle(150)

    const today = new Date().toISOString().slice(0, 10)
    const content = await readFile(join(dir, `app-${today}.log`))
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(content).toContain('Line one')
    expect(content).toContain('Line two')
    expect(content).toContain('Line three')
  })

  test('respects minimum log level', async () => {
    const dir = await makeTempDir()
    const basePath = join(dir, 'level.log')
    const driver = new DailyDriver('daily', basePath, 'error')

    driver.debug('Ignored debug')
    driver.info('Ignored info')
    driver.error('Kept error')
    driver.critical('Kept critical')
    await settle()

    const today = new Date().toISOString().slice(0, 10)
    const content = await readFile(join(dir, `level-${today}.log`))
    expect(content).not.toContain('Ignored')
    expect(content).toContain('Kept error')
    expect(content).toContain('Kept critical')
  })

  test('uses custom formatter', async () => {
    const dir = await makeTempDir()
    const basePath = join(dir, 'fmt.log')
    const driver = new DailyDriver('daily', basePath, 'debug', 14, new JsonFormatter())

    driver.info('JSON daily', { foo: 'bar' })
    await settle()

    const today = new Date().toISOString().slice(0, 10)
    const content = await readFile(join(dir, `fmt-${today}.log`))
    const parsed = JSON.parse(content.trim())
    expect(parsed.message).toBe('JSON daily')
    expect(parsed.context.foo).toBe('bar')
  })

  test('maxFiles pruning removes old log files', async () => {
    const dir = await makeTempDir()
    const basePath = join(dir, 'prune.log')

    // Pre-create "old" log files with dates older than the maxFiles window
    const oldDates = ['2020-01-01', '2020-01-02', '2020-01-03']
    for (const d of oldDates) {
      await Bun.write(join(dir, `prune-${d}.log`), `old log from ${d}\n`)
    }

    // Create driver with maxFiles=1 day (anything older than 1 day should be pruned)
    const driver = new DailyDriver('daily', basePath, 'debug', 1)

    driver.info('Current entry')
    await settle(300) // pruning is async fire-and-forget, give it time

    const files = await readdir(dir)
    const logFiles = files.filter((f) => f.startsWith('prune-') && f.endsWith('.log'))

    // Old files should be pruned; only today's file should remain
    const today = new Date().toISOString().slice(0, 10)
    for (const d of oldDates) {
      expect(logFiles).not.toContain(`prune-${d}.log`)
    }
    expect(logFiles).toContain(`prune-${today}.log`)
  })

  test('creates nested directories for daily log path', async () => {
    const dir = await makeTempDir()
    const basePath = join(dir, 'logs', 'nested', 'daily.log')
    const driver = new DailyDriver('daily', basePath)

    driver.info('Nested daily')
    await settle()

    const today = new Date().toISOString().slice(0, 10)
    const content = await readFile(join(dir, 'logs', 'nested', `daily-${today}.log`))
    expect(content).toContain('Nested daily')
  })
})

// ── LogManager with file channel ────────────────────────────────────────────

describe('LogManager with file channels', () => {
  test('creates and uses a file channel from config', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'managed.log')

    const manager = new LogManager({
      default: 'file',
      channels: {
        file: {
          driver: 'file',
          path: logPath,
          level: 'debug',
        },
      },
    })

    manager.info('Managed log entry')
    await settle()

    const content = await readFile(logPath)
    expect(content).toContain('Managed log entry')
    expect(content).toContain('INFO')
  })

  test('creates and uses a daily channel from config', async () => {
    const dir = await makeTempDir()
    const basePath = join(dir, 'daily-managed.log')

    const manager = new LogManager({
      default: 'daily',
      channels: {
        daily: {
          driver: 'daily',
          path: basePath,
          level: 'debug',
          days: 7,
        },
      },
    })

    manager.warning('Daily managed warning')
    await settle()

    const today = new Date().toISOString().slice(0, 10)
    const content = await readFile(join(dir, `daily-managed-${today}.log`))
    expect(content).toContain('Daily managed warning')
  })

  test('supports json formatter through config', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'json-managed.log')

    const manager = new LogManager({
      default: 'jsonfile',
      channels: {
        jsonfile: {
          driver: 'file',
          path: logPath,
          level: 'debug',
          formatter: 'json',
        },
      },
    })

    manager.error('JSON managed error', { code: 500 })
    await settle()

    const content = await readFile(logPath)
    const parsed = JSON.parse(content.trim())
    expect(parsed.level).toBe('error')
    expect(parsed.message).toBe('JSON managed error')
    expect(parsed.context.code).toBe(500)
  })

  test('can switch between multiple channels', async () => {
    const dir = await makeTempDir()
    const errorPath = join(dir, 'errors.log')
    const debugPath = join(dir, 'debug.log')

    const manager = new LogManager({
      default: 'errors',
      channels: {
        errors: {
          driver: 'file',
          path: errorPath,
          level: 'error',
        },
        debug: {
          driver: 'file',
          path: debugPath,
          level: 'debug',
        },
      },
    })

    // Default channel (errors) — only error+ levels
    manager.error('Critical failure')
    manager.debug('Debug ignored on error channel')

    // Explicit debug channel
    manager.channel('debug').debug('Debug visible on debug channel')
    await settle()

    const errorContent = await readFile(errorPath)
    expect(errorContent).toContain('Critical failure')
    expect(errorContent).not.toContain('Debug ignored')

    const debugContent = await readFile(debugPath)
    expect(debugContent).toContain('Debug visible on debug channel')
  })

  test('driver() returns same instance for same channel name', () => {
    const manager = new LogManager({
      default: 'console',
      channels: {},
    })

    const a = manager.driver('console')
    const b = manager.driver('console')
    expect(a).toBe(b)
  })

  test('forgetChannel removes cached driver', async () => {
    const dir = await makeTempDir()
    const logPath = join(dir, 'forget.log')

    const manager = new LogManager({
      default: 'file',
      channels: {
        file: { driver: 'file', path: logPath, level: 'debug' },
      },
    })

    const first = manager.driver('file')
    manager.forgetChannel('file')
    const second = manager.driver('file')

    expect(first).not.toBe(second)
  })

  test('throws for unconfigured channel', () => {
    const manager = new LogManager({
      default: 'console',
      channels: {},
    })

    expect(() => manager.driver('nonexistent')).toThrow('not configured')
  })
})
