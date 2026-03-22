import { describe, it, expect } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTemplates, type TemplateContext } from '../../src/templates.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    name: 'test-app',
    appKey: 'base64:dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleT0=',
    kit: undefined,
    ui: 'none',
    ...overrides,
  }
}

// ── getTemplates() — dynamic files only ──────────────────────────────────────

describe('getTemplates() — API-only', () => {
  const templates = getTemplates(makeCtx())

  it('generates package.json', () => {
    expect(templates['package.json']).toBeDefined()
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.name).toBe('test-app')
    expect(pkg.private).toBe(true)
    expect(pkg.type).toBe('module')
  })

  it('package.json has core dependencies', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['@mantiq/core']).toBeDefined()
    expect(pkg.dependencies['@mantiq/database']).toBeDefined()
    expect(pkg.dependencies['@mantiq/auth']).toBeDefined()
    expect(pkg.dependencies['@mantiq/cli']).toBeDefined()
  })

  it('package.json has all framework deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    const deps = Object.keys(pkg.dependencies)
    expect(deps).toContain('@mantiq/events')
    expect(deps).toContain('@mantiq/queue')
    expect(deps).toContain('@mantiq/mail')
    expect(deps).toContain('@mantiq/notify')
    expect(deps).toContain('@mantiq/search')
    expect(deps).toContain('@mantiq/health')
    expect(deps).toContain('@mantiq/heartbeat')
  })

  it('package.json has dev script', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.scripts.dev).toBe('bun run --watch index.ts')
    expect(pkg.scripts.mantiq).toBe('bun run mantiq.ts')
  })

  it('API-only has no vite deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['@mantiq/vite']).toBeUndefined()
    expect(pkg.devDependencies['vite']).toBeUndefined()
  })

  it('generates .env with APP_KEY', () => {
    expect(templates['.env']).toBeDefined()
    expect(templates['.env']).toContain('APP_KEY=base64:')
    expect(templates['.env']).toContain('APP_NAME=test-app')
  })

  it('generates .env.example without actual key', () => {
    expect(templates['.env.example']).toBeDefined()
    expect(templates['.env.example']).toContain('APP_KEY=')
    expect(templates['.env.example']).not.toContain('base64:dGVzdGtl')
  })

  it('API-only .env has no VITE_DEV_SERVER_URL', () => {
    expect(templates['.env']).not.toContain('VITE_DEV_SERVER_URL')
  })

  it('only generates 3 dynamic files', () => {
    const keys = Object.keys(templates)
    expect(keys).toHaveLength(3)
    expect(keys).toContain('package.json')
    expect(keys).toContain('.env')
    expect(keys).toContain('.env.example')
  })
})

// ── getTemplates() — React kit ───────────────────────────────────────────────

describe('getTemplates() — React kit', () => {
  const templates = getTemplates(makeCtx({ kit: 'react' }))

  it('adds React deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['react']).toBeDefined()
    expect(pkg.devDependencies['react-dom']).toBeDefined()
    expect(pkg.devDependencies['@vitejs/plugin-react']).toBeDefined()
  })

  it('adds vite deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['@mantiq/vite']).toBeDefined()
    expect(pkg.devDependencies['vite']).toBe('^8.0.0')
    expect(pkg.devDependencies['tailwindcss']).toBeDefined()
  })

  it('adds UI deps (radix, lucide)', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['radix-ui']).toBeDefined()
    expect(pkg.dependencies['lucide-react']).toBeDefined()
  })

  it('has concurrent dev script', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.scripts.dev).toContain('dev:backend')
    expect(pkg.scripts.dev).toContain('dev:frontend')
    expect(pkg.scripts['dev:frontend']).toContain('vite')
  })

  it('has build script with SSR (.tsx)', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.scripts.build).toContain('src/ssr.tsx')
  })

  it('.env has VITE_DEV_SERVER_URL', () => {
    expect(templates['.env']).toContain('VITE_DEV_SERVER_URL')
  })
})

// ── getTemplates() — Vue kit ─────────────────────────────────────────────────

describe('getTemplates() — Vue kit', () => {
  const templates = getTemplates(makeCtx({ kit: 'vue' }))

  it('adds Vue deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['vue']).toBeDefined()
    expect(pkg.devDependencies['@vitejs/plugin-vue']).toBeDefined()
  })

  it('SSR entry is .ts (not .tsx)', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.scripts.build).toContain('src/ssr.ts')
    expect(pkg.scripts.build).not.toContain('src/ssr.tsx')
  })
})

// ── getTemplates() — Svelte kit ──────────────────────────────────────────────

describe('getTemplates() — Svelte kit', () => {
  const templates = getTemplates(makeCtx({ kit: 'svelte' }))

  it('adds Svelte deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['svelte']).toBeDefined()
    expect(pkg.devDependencies['@sveltejs/vite-plugin-svelte']).toBeDefined()
  })
})

// ── Skeleton directory ───────────────────────────────────────────────────────

describe('Skeleton directory', () => {
  const skeletonDir = join(import.meta.dir, '../../skeleton')

  it('exists', () => {
    expect(existsSync(skeletonDir)).toBe(true)
  })

  it('has index.ts', () => {
    expect(existsSync(join(skeletonDir, 'index.ts'))).toBe(true)
  })

  it('has mantiq.ts', () => {
    expect(existsSync(join(skeletonDir, 'mantiq.ts'))).toBe(true)
  })

  it('index.ts is clean (< 25 lines)', () => {
    const content = readFileSync(join(skeletonDir, 'index.ts'), 'utf-8')
    const lines = content.split('\n').filter(l => l.trim()).length
    expect(lines).toBeLessThanOrEqual(25)
  })

  it('mantiq.ts is clean (< 10 lines)', () => {
    const content = readFileSync(join(skeletonDir, 'mantiq.ts'), 'utf-8')
    const lines = content.split('\n').filter(l => l.trim()).length
    expect(lines).toBeLessThanOrEqual(10)
  })

  it('has config directory with expected files', () => {
    const configs = readdirSync(join(skeletonDir, 'config'))
    expect(configs).toContain('app.ts')
    expect(configs).toContain('database.ts')
    expect(configs).toContain('auth.ts')
  })

  it('has User model', () => {
    expect(existsSync(join(skeletonDir, 'app/Models/User.ts'))).toBe(true)
  })

  it('has PersonalAccessToken model', () => {
    expect(existsSync(join(skeletonDir, 'app/Models/PersonalAccessToken.ts'))).toBe(true)
  })

  it('has migrations', () => {
    const migrations = readdirSync(join(skeletonDir, 'database/migrations'))
    expect(migrations.length).toBeGreaterThanOrEqual(2)
  })

  it('has routes', () => {
    expect(existsSync(join(skeletonDir, 'routes/web.ts'))).toBe(true)
    expect(existsSync(join(skeletonDir, 'routes/api.ts'))).toBe(true)
  })

  it('has DatabaseServiceProvider', () => {
    expect(existsSync(join(skeletonDir, 'app/Providers/DatabaseServiceProvider.ts'))).toBe(true)
  })

  it('index.ts imports only @mantiq/core', () => {
    const content = readFileSync(join(skeletonDir, 'index.ts'), 'utf-8')
    const imports = content.match(/from ['"]@mantiq\//g) ?? []
    expect(imports.length).toBe(1)
    expect(content).toContain("from '@mantiq/core'")
  })

  it('index.ts has no .env loading code', () => {
    const content = readFileSync(join(skeletonDir, 'index.ts'), 'utf-8')
    expect(content).not.toContain('Load .env')
    expect(content).not.toContain('envFile')
  })

  it('index.ts uses Discoverer', () => {
    const content = readFileSync(join(skeletonDir, 'index.ts'), 'utf-8')
    expect(content).toContain('Discoverer')
    expect(content).toContain('app.bootstrap')
  })

  it('mantiq.ts uses auto-discovery', () => {
    const content = readFileSync(join(skeletonDir, 'mantiq.ts'), 'utf-8')
    expect(content).toContain("import { Kernel } from '@mantiq/cli'")
    expect(content).toContain('kernel.run()')
    expect(content).not.toContain('MigrateCommand')
  })
})
