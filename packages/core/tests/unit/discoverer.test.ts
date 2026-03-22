import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Discoverer } from '../../src/discovery/Discoverer.ts'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mantiq-discover-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeFile(relPath: string, content: string) {
  const full = join(tmpDir, relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

// ── Scanning ─────────────────────────────────────────────────────────────────

describe('Discoverer.build()', () => {
  test('discovers providers in app/Providers/', async () => {
    writeFile('app/Providers/AppServiceProvider.ts', 'export class AppServiceProvider { register() {} boot() {} }')
    writeFile('app/Providers/AuthServiceProvider.ts', 'export class AuthServiceProvider { register() {} boot() {} }')

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.providers).toHaveLength(2)
    expect(manifest.providers).toContain('app/Providers/AppServiceProvider.ts')
    expect(manifest.providers).toContain('app/Providers/AuthServiceProvider.ts')
  })

  test('discovers commands in app/Console/Commands/', async () => {
    writeFile('app/Console/Commands/SendReportCommand.ts', 'export class SendReportCommand {}')

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.commands).toHaveLength(1)
    expect(manifest.commands[0]).toBe('app/Console/Commands/SendReportCommand.ts')
  })

  test('discovers routes in routes/', async () => {
    writeFile('routes/web.ts', 'export default function(r: any) {}')
    writeFile('routes/api.ts', 'export default function(r: any) {}')
    writeFile('routes/console.ts', 'export default function(r: any) {}')

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.routes).toHaveLength(3)
    expect(manifest.routes).toContain('routes/web.ts')
    expect(manifest.routes).toContain('routes/api.ts')
  })

  test('discovers models in app/Models/', async () => {
    writeFile('app/Models/User.ts', 'export class User {}')
    writeFile('app/Models/Post.ts', 'export class Post {}')

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.models).toHaveLength(2)
  })

  test('discovers policies in app/Policies/', async () => {
    writeFile('app/Policies/PostPolicy.ts', 'export class PostPolicy {}')

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.policies).toHaveLength(1)
  })

  test('ignores .test.ts and .spec.ts files', async () => {
    writeFile('app/Models/User.ts', 'export class User {}')
    writeFile('app/Models/User.test.ts', 'test("x", () => {})')
    writeFile('app/Models/User.spec.ts', 'test("x", () => {})')

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.models).toHaveLength(1)
    expect(manifest.models[0]).toBe('app/Models/User.ts')
  })

  test('ignores dotfiles', async () => {
    writeFile('app/Models/User.ts', 'export class User {}')
    writeFile('app/Models/.gitkeep', '')

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.models).toHaveLength(1)
  })

  test('handles missing directories gracefully', async () => {
    // No directories exist at all
    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.providers).toHaveLength(0)
    expect(manifest.commands).toHaveLength(0)
    expect(manifest.routes).toHaveLength(0)
    expect(manifest.models).toHaveLength(0)
  })

  test('results are sorted alphabetically', async () => {
    writeFile('routes/web.ts', '')
    writeFile('routes/api.ts', '')
    writeFile('routes/console.ts', '')

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()

    expect(manifest.routes).toEqual([
      'routes/api.ts',
      'routes/console.ts',
      'routes/web.ts',
    ])
  })

  test('sets timestamp', async () => {
    const before = Date.now()
    const d = new Discoverer(tmpDir)
    const manifest = await d.build()
    const after = Date.now()

    expect(manifest.timestamp).toBeGreaterThanOrEqual(before)
    expect(manifest.timestamp).toBeLessThanOrEqual(after)
  })
})

// ── Caching ──────────────────────────────────────────────────────────────────

describe('Manifest caching', () => {
  test('build() writes bootstrap/manifest.json', async () => {
    writeFile('app/Models/User.ts', 'export class User {}')

    const d = new Discoverer(tmpDir)
    await d.build()

    const manifestPath = join(tmpDir, 'bootstrap', 'manifest.json')
    expect(existsSync(manifestPath)).toBe(true)

    const cached = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(cached.models).toContain('app/Models/User.ts')
  })

  test('cached() returns manifest from file', async () => {
    writeFile('app/Models/User.ts', 'export class User {}')

    const d = new Discoverer(tmpDir)
    await d.build()

    const cached = d.cached()
    expect(cached).not.toBeNull()
    expect(cached!.models).toContain('app/Models/User.ts')
  })

  test('cached() returns null when no manifest exists', () => {
    const d = new Discoverer(tmpDir)
    expect(d.cached()).toBeNull()
  })

  test('resolve() rebuilds in dev mode', async () => {
    writeFile('app/Models/User.ts', 'export class User {}')

    const d = new Discoverer(tmpDir)
    const manifest = await d.resolve(true) // dev

    expect(manifest.models).toHaveLength(1)
  })

  test('resolve() uses cache in production', async () => {
    // Pre-populate cache with stale data
    writeFile('bootstrap/manifest.json', JSON.stringify({
      providers: [], commands: [], routes: [], models: ['app/Models/OldModel.ts'],
      policies: [], middleware: [], observers: [], listeners: [], jobs: [],
      timestamp: 1000,
    }))

    // Add a new model that shouldn't be discovered in prod
    writeFile('app/Models/NewModel.ts', 'export class NewModel {}')

    const d = new Discoverer(tmpDir)
    const manifest = await d.resolve(false) // production — uses cache

    expect(manifest.models).toEqual(['app/Models/OldModel.ts']) // stale cache
    expect(manifest.timestamp).toBe(1000)
  })

  test('resolve() falls back to build when no cache in production', async () => {
    writeFile('app/Models/User.ts', 'export class User {}')

    const d = new Discoverer(tmpDir)
    const manifest = await d.resolve(false) // production, no cache

    expect(manifest.models).toHaveLength(1) // built fresh
  })
})

// ── Loaders ──────────────────────────────────────────────────────────────────

describe('Discoverer.loadProviders()', () => {
  test('loads provider classes from manifest', async () => {
    writeFile('app/Providers/TestServiceProvider.ts', `
      export class TestServiceProvider {
        register() { return 'registered' }
        async boot() { return 'booted' }
      }
    `)

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()
    const providers = await d.loadProviders(manifest)

    expect(providers).toHaveLength(1)
    expect(typeof providers[0]).toBe('function')
  })

  test('skips files that fail to import', async () => {
    const manifest = {
      ...JSON.parse(JSON.stringify(require('../../src/discovery/Discoverer.ts').Discoverer ? {} : {})),
      providers: ['app/Providers/NonExistent.ts'],
      commands: [], routes: [], models: [], policies: [],
      middleware: [], observers: [], listeners: [], jobs: [],
      timestamp: 0,
    }

    const d = new Discoverer(tmpDir)
    const providers = await d.loadProviders(manifest as any)

    expect(providers).toHaveLength(0) // no crash
  })
})

describe('Discoverer.loadRoutes()', () => {
  test('calls default export with router', async () => {
    writeFile('routes/test.ts', `
      export default function(router: any) {
        router.registered = true
      }
    `)

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()
    const mockRouter: any = { registered: false }
    await d.loadRoutes(manifest, mockRouter)

    expect(mockRouter.registered).toBe(true)
  })

  test('skips files without default export', async () => {
    writeFile('routes/helpers.ts', `
      export function someHelper() { return true }
    `)

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()
    const mockRouter: any = {}
    await d.loadRoutes(manifest, mockRouter) // no crash
  })
})

describe('Discoverer.loadCommands()', () => {
  test('loads command instances from manifest', async () => {
    writeFile('app/Console/Commands/TestCommand.ts', `
      export class TestCommand {
        name = 'test:run'
        description = 'A test command'
        async handle() { return 0 }
      }
    `)

    const d = new Discoverer(tmpDir)
    const manifest = await d.build()
    const commands = await d.loadCommands(manifest)

    expect(commands).toHaveLength(1)
    expect(commands[0].name).toBe('test:run')
  })
})
