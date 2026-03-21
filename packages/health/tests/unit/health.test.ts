import { describe, test, expect, mock } from 'bun:test'
import { HealthCheck } from '../../src/HealthCheck.ts'
import { HealthManager } from '../../src/HealthManager.ts'
import { EnvironmentCheck } from '../../src/checks/EnvironmentCheck.ts'
import { MemoryCheck } from '../../src/checks/MemoryCheck.ts'
import { AppCheck } from '../../src/checks/AppCheck.ts'
import { CacheCheck } from '../../src/checks/CacheCheck.ts'
import { QueueCheck } from '../../src/checks/QueueCheck.ts'
import { RouterCheck } from '../../src/checks/RouterCheck.ts'
import { MailCheck } from '../../src/checks/MailCheck.ts'
import { AuthCheck } from '../../src/checks/AuthCheck.ts'
import { SchedulerCheck } from '../../src/checks/SchedulerCheck.ts'
import { StorageCheck } from '../../src/checks/StorageCheck.ts'
import { UptimeCheck } from '../../src/checks/UptimeCheck.ts'
import { healthHandler, healthHeaderValue } from '../../src/HealthHandler.ts'

// ── Custom check helpers ─────────────────────────────────────────────────────

class PassingCheck extends HealthCheck {
  readonly name = 'passing'
  override async run() { this.meta('ok', true) }
}

class DegradedCheck extends HealthCheck {
  readonly name = 'degraded'
  override async run() { this.degrade('Running slow') }
}

class FailingCheck extends HealthCheck {
  readonly name = 'failing'
  override async run() { throw new Error('Connection refused') }
}

// ── HealthCheck ──────────────────────────────────────────────────────────────

describe('HealthCheck', () => {
  test('passing check returns ok status', async () => {
    const result = await new PassingCheck().execute()
    expect(result.name).toBe('passing')
    expect(result.status).toBe('ok')
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.meta).toEqual({ ok: true })
  })

  test('degraded check returns degraded status', async () => {
    const result = await new DegradedCheck().execute()
    expect(result.status).toBe('degraded')
    expect(result.message).toBe('Running slow')
  })

  test('failing check returns critical status', async () => {
    const result = await new FailingCheck().execute()
    expect(result.status).toBe('critical')
    expect(result.message).toBe('Connection refused')
  })
})

// ── HealthManager ────────────────────────────────────────────────────────────

describe('HealthManager', () => {
  test('all checks pass → ok', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    const report = await manager.check()
    expect(report.status).toBe('ok')
    expect(report.checks).toHaveLength(1)
    expect(report.checks[0]!.name).toBe('passing')
  })

  test('one degraded → overall degraded', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    manager.register(new DegradedCheck())
    const report = await manager.check()
    expect(report.status).toBe('degraded')
  })

  test('one critical → overall critical', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    manager.register(new DegradedCheck())
    manager.register(new FailingCheck())
    const report = await manager.check()
    expect(report.status).toBe('critical')
  })

  test('critical overrides degraded', async () => {
    const manager = new HealthManager()
    manager.register(new DegradedCheck())
    manager.register(new FailingCheck())
    expect(await manager.status()).toBe('critical')
  })

  test('empty manager → ok', async () => {
    const manager = new HealthManager()
    const report = await manager.check()
    expect(report.status).toBe('ok')
    expect(report.checks).toHaveLength(0)
  })

  test('registerMany adds multiple checks', async () => {
    const manager = new HealthManager()
    manager.registerMany([new PassingCheck(), new UptimeCheck()])
    expect(manager.getCheckNames()).toEqual(['passing', 'uptime'])
  })

  test('lastReport is cached after check()', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    expect(manager.lastReport).toBeNull()
    await manager.check()
    expect(manager.lastReport).not.toBeNull()
    expect(manager.lastReport!.status).toBe('ok')
  })

  test('report includes timestamp and duration', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    const report = await manager.check()
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(report.duration).toBeGreaterThanOrEqual(0)
  })
})

// ── Built-in checks ──────────────────────────────────────────────────────────

describe('EnvironmentCheck', () => {
  test('passes when all vars are set', async () => {
    process.env['HEALTH_TEST_VAR'] = 'yes'
    const check = new EnvironmentCheck(['HEALTH_TEST_VAR'])
    const result = await check.execute()
    expect(result.status).toBe('ok')
    delete process.env['HEALTH_TEST_VAR']
  })

  test('fails when a var is missing', async () => {
    const check = new EnvironmentCheck(['NONEXISTENT_VAR_12345'])
    const result = await check.execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('NONEXISTENT_VAR_12345')
  })
})

describe('MemoryCheck', () => {
  test('passes under normal conditions', async () => {
    const check = new MemoryCheck({ warnAt: 2048, criticalAt: 4096 })
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.heap).toBeDefined()
    expect(result.meta?.rss).toBeDefined()
  })

  test('degrades when over warn threshold', async () => {
    const check = new MemoryCheck({ warnAt: 1, criticalAt: 4096 }) // 1MB warn
    const result = await check.execute()
    expect(result.status).toBe('degraded')
  })

  test('fails when over critical threshold', async () => {
    const check = new MemoryCheck({ warnAt: 1, criticalAt: 1 }) // 1MB critical — always exceeds in bun
    const result = await check.execute()
    expect(result.status).toBe('critical')
  })
})

describe('StorageCheck', () => {
  test('passes for writable directory', async () => {
    const check = new StorageCheck('/tmp')
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.writable).toBe(true)
  })

  test('fails for non-writable path', async () => {
    const check = new StorageCheck('/proc/nonexistent/path')
    const result = await check.execute()
    expect(result.status).toBe('critical')
  })
})

describe('UptimeCheck', () => {
  test('always passes and reports uptime', async () => {
    const check = new UptimeCheck()
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.seconds).toBeGreaterThanOrEqual(0)
    expect(result.meta?.formatted).toBeDefined()
    expect(result.meta?.pid).toBe(process.pid)
  })
})

// ── Handler ──────────────────────────────────────────────────────────────────

describe('healthHandler', () => {
  test('returns 200 with ok status', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    const handler = healthHandler(manager, true)
    const res = await handler(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks).toHaveLength(1)
  })

  test('returns 503 on critical', async () => {
    const manager = new HealthManager()
    manager.register(new FailingCheck())
    const handler = healthHandler(manager, true)
    const res = await handler(new Request('http://localhost/health'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('critical')
  })

  test('production mode strips meta and messages', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    const handler = healthHandler(manager, false)
    const res = await handler(new Request('http://localhost/health'))
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks).toBeUndefined() // no checks on ok in prod
    expect(body.meta).toBeUndefined()
  })

  test('production mode includes failing check names', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    manager.register(new FailingCheck())
    const handler = healthHandler(manager, false)
    const res = await handler(new Request('http://localhost/health'))
    const body = await res.json()
    expect(body.status).toBe('critical')
    expect(body.checks).toEqual([{ name: 'failing', status: 'critical' }])
  })
})

describe('healthHeaderValue', () => {
  test('returns "ok" when healthy', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    expect(await healthHeaderValue(manager)).toBe('ok')
  })

  test('returns "critical:failing" when critical', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    manager.register(new FailingCheck())
    expect(await healthHeaderValue(manager)).toBe('critical:failing')
  })

  test('returns "degraded:degraded" when degraded', async () => {
    const manager = new HealthManager()
    manager.register(new PassingCheck())
    manager.register(new DegradedCheck())
    expect(await healthHeaderValue(manager)).toBe('degraded:degraded')
  })
})

// ── Application checks ───────────────────────────────────────────────────────

describe('AppCheck', () => {
  test('fails when APP_KEY is missing', async () => {
    const origKey = process.env['APP_KEY']
    delete process.env['APP_KEY']
    const check = new AppCheck({})
    const result = await check.execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('APP_KEY')
    if (origKey) process.env['APP_KEY'] = origKey
  })

  test('passes when APP_KEY is set', async () => {
    process.env['APP_KEY'] = 'base64:abcdefghijklmnopqrstuvwxyz123456'
    const check = new AppCheck({})
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.key).toBe('set')
    delete process.env['APP_KEY']
  })

  test('fails when app is null', async () => {
    const check = new AppCheck(null)
    const result = await check.execute()
    expect(result.status).toBe('critical')
  })
})

describe('CacheCheck', () => {
  test('passes when cache can read/write', async () => {
    const store: Record<string, any> = {}
    const mockCache = {
      getDefaultDriver: () => 'memory',
      put: mock(async (k: string, v: any) => { store[k] = v }),
      get: mock(async (k: string) => store[k]),
      forget: mock(async (k: string) => { delete store[k] }),
    }
    const check = new CacheCheck(mockCache)
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('memory')
  })

  test('fails when cache is null', async () => {
    const check = new CacheCheck(null)
    const result = await check.execute()
    expect(result.status).toBe('critical')
  })
})

describe('QueueCheck', () => {
  test('passes with working queue', async () => {
    const mockQueue = {
      getDefaultDriver: () => 'sync',
      size: mock(async () => 5),
    }
    const check = new QueueCheck(mockQueue)
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.pending).toBe(5)
  })

  test('fails when queue is null', async () => {
    const check = new QueueCheck(null)
    const result = await check.execute()
    expect(result.status).toBe('critical')
  })
})

describe('RouterCheck', () => {
  test('passes with registered routes', async () => {
    const mockRouter = {
      getRoutes: () => [
        { path: '/' },
        { path: '/dashboard' },
        { path: '/api/users' },
      ],
    }
    const check = new RouterCheck(mockRouter)
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.routes).toBe(3)
  })

  test('fails with no routes', async () => {
    const check = new RouterCheck({ getRoutes: () => [] })
    const result = await check.execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('No routes')
  })

  test('degrades when expected routes are missing', async () => {
    const mockRouter = {
      getRoutes: () => [{ path: '/' }],
    }
    const check = new RouterCheck(mockRouter, ['/', '/health', '/api/ping'])
    const result = await check.execute()
    expect(result.status).toBe('degraded')
    expect(result.meta?.missing).toContain('/health')
  })
})

describe('MailCheck', () => {
  test('passes with configured mail', async () => {
    const mockMail = {
      getDefaultDriver: () => 'smtp',
      driver: () => ({ send: mock() }),
    }
    const check = new MailCheck(mockMail)
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('smtp')
  })

  test('fails when mail is null', async () => {
    const check = new MailCheck(null)
    const result = await check.execute()
    expect(result.status).toBe('critical')
  })
})

describe('AuthCheck', () => {
  test('passes with configured auth', async () => {
    const mockAuth = {
      getDefaultGuard: () => 'web',
      guard: () => ({ getProvider: () => ({ constructor: { name: 'DatabaseProvider' } }) }),
    }
    const check = new AuthCheck(mockAuth)
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.guard).toBe('web')
    expect(result.meta?.provider).toBe('DatabaseProvider')
  })

  test('fails when auth is null', async () => {
    const check = new AuthCheck(null)
    const result = await check.execute()
    expect(result.status).toBe('critical')
  })
})

describe('SchedulerCheck', () => {
  test('passes with tasks registered', async () => {
    const mockScheduler = {
      events: () => [{ command: 'prune:sessions' }, { command: 'queue:work' }],
    }
    const check = new SchedulerCheck(mockScheduler)
    const result = await check.execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.tasks).toBe(2)
  })

  test('degrades with no tasks', async () => {
    const check = new SchedulerCheck({ events: () => [] })
    const result = await check.execute()
    expect(result.status).toBe('degraded')
  })

  test('fails when scheduler is null', async () => {
    const check = new SchedulerCheck(null)
    const result = await check.execute()
    expect(result.status).toBe('critical')
  })
})
