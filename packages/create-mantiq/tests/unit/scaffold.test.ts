import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
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

/** Write all template files to a temp directory and return the path. */
function scaffoldToDir(ctx: TemplateContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'mantiq-scaffold-'))
  const templates = getTemplates(ctx)
  for (const [relativePath, content] of Object.entries(templates)) {
    const fullPath = join(dir, relativePath)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content, 'utf-8')
  }
  return dir
}

/** Recursively collect all file paths relative to `root`. */
function collectFiles(root: string, prefix = ''): string[] {
  const results: string[] = []
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...collectFiles(root, rel))
    } else {
      results.push(rel)
    }
  }
  return results
}

// ── Template Generation: API-only ───────────────────────────────────────────

describe('create-mantiq — API-only templates', () => {
  let templates: Record<string, string>

  beforeEach(() => {
    templates = getTemplates(makeCtx())
  })

  it('generates package.json', () => {
    expect(templates['package.json']).toBeDefined()
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.name).toBe('test-app')
  })

  it('generates index.ts', () => {
    expect(templates['index.ts']).toBeDefined()
  })

  it('generates mantiq.ts', () => {
    expect(templates['mantiq.ts']).toBeDefined()
  })

  it('generates .env', () => {
    expect(templates['.env']).toBeDefined()
  })

  it('generates config files', () => {
    expect(templates['config/app.ts']).toBeDefined()
    expect(templates['config/database.ts']).toBeDefined()
    expect(templates['config/auth.ts']).toBeDefined()
    expect(templates['config/logging.ts']).toBeDefined()
    expect(templates['config/queue.ts']).toBeDefined()
    expect(templates['config/filesystem.ts']).toBeDefined()
    expect(templates['config/mail.ts']).toBeDefined()
  })

  it('generates model files', () => {
    expect(templates['app/Models/User.ts']).toBeDefined()
    expect(templates['app/Models/PersonalAccessToken.ts']).toBeDefined()
  })

  it('generates migration files', () => {
    expect(templates['database/migrations/001_create_users_table.ts']).toBeDefined()
    expect(templates['database/migrations/002_create_personal_access_tokens_table.ts']).toBeDefined()
  })

  it('generates route files', () => {
    expect(templates['routes/web.ts']).toBeDefined()
    expect(templates['routes/api.ts']).toBeDefined()
  })

  it('generates controller files', () => {
    expect(templates['app/Http/Controllers/HomeController.ts']).toBeDefined()
  })

  it('generates seeder files', () => {
    expect(templates['database/seeders/DatabaseSeeder.ts']).toBeDefined()
  })

  it('generates tsconfig.json', () => {
    expect(templates['tsconfig.json']).toBeDefined()
    const tsconfig = JSON.parse(templates['tsconfig.json']!)
    expect(tsconfig.compilerOptions.strict).toBe(true)
    expect(tsconfig.compilerOptions.noImplicitOverride).toBe(true)
  })
})

// ── Template Generation: React Kit ──────────────────────────────────────────

describe('create-mantiq — React kit templates', () => {
  let templates: Record<string, string>

  beforeEach(() => {
    templates = getTemplates(makeCtx({ kit: 'react' }))
  })

  it('package.json includes React deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['react']).toBeDefined()
    expect(pkg.devDependencies['react-dom']).toBeDefined()
    expect(pkg.devDependencies['@vitejs/plugin-react']).toBeDefined()
  })

  it('package.json includes @mantiq/vite dep', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['@mantiq/vite']).toBeDefined()
  })

  it('package.json includes vite devDependency', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['vite']).toBeDefined()
  })

  it('package.json includes tailwindcss devDependency', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['tailwindcss']).toBeDefined()
  })

  it('package.json has build script with SSR entry (.tsx for React)', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.scripts.build).toContain('src/ssr.tsx')
  })

  it('package.json has frontend dev script', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.scripts['dev:frontend']).toBeDefined()
  })

  it('index.ts imports ViteServiceProvider', () => {
    expect(templates['index.ts']).toContain('ViteServiceProvider')
  })

  it('index.ts imports ServeStaticFiles', () => {
    expect(templates['index.ts']).toContain('ServeStaticFiles')
  })

  it('package.json includes UI deps (shadcn-related)', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['clsx']).toBeDefined()
    expect(pkg.dependencies['lucide-react']).toBeDefined()
  })
})

// ── Template Generation: Vue Kit ────────────────────────────────────────────

describe('create-mantiq — Vue kit templates', () => {
  let templates: Record<string, string>

  beforeEach(() => {
    templates = getTemplates(makeCtx({ kit: 'vue' }))
  })

  it('package.json includes Vue deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['vue']).toBeDefined()
    expect(pkg.devDependencies['@vitejs/plugin-vue']).toBeDefined()
  })

  it('package.json includes @mantiq/vite dep', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['@mantiq/vite']).toBeDefined()
  })

  it('package.json includes vite devDependency', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['vite']).toBeDefined()
  })

  it('package.json has build script with SSR entry (.ts for Vue)', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.scripts.build).toContain('src/ssr.ts')
    // Vue uses .ts not .tsx
    expect(pkg.scripts.build).not.toContain('.tsx')
  })

  it('package.json includes Vue UI deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['lucide-vue-next']).toBeDefined()
    expect(pkg.dependencies['reka-ui']).toBeDefined()
  })

  it('index.ts imports ViteServiceProvider for Vue kit', () => {
    expect(templates['index.ts']).toContain('ViteServiceProvider')
  })
})

// ── Template Generation: Svelte Kit ─────────────────────────────────────────

describe('create-mantiq — Svelte kit templates', () => {
  let templates: Record<string, string>

  beforeEach(() => {
    templates = getTemplates(makeCtx({ kit: 'svelte' }))
  })

  it('package.json includes Svelte deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['svelte']).toBeDefined()
    expect(pkg.devDependencies['@sveltejs/vite-plugin-svelte']).toBeDefined()
  })

  it('package.json includes @mantiq/vite dep', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['@mantiq/vite']).toBeDefined()
  })

  it('package.json includes vite devDependency', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.devDependencies['vite']).toBeDefined()
  })

  it('package.json has build script with SSR entry (.ts for Svelte)', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.scripts.build).toContain('src/ssr.ts')
    expect(pkg.scripts.build).not.toContain('.tsx')
  })

  it('package.json includes Svelte UI deps', () => {
    const pkg = JSON.parse(templates['package.json']!)
    expect(pkg.dependencies['bits-ui']).toBeDefined()
    expect(pkg.dependencies['lucide-svelte']).toBeDefined()
  })

  it('index.ts imports ViteServiceProvider for Svelte kit', () => {
    expect(templates['index.ts']).toContain('ViteServiceProvider')
  })
})

// ── package.json Dependencies ───────────────────────────────────────────────

describe('create-mantiq — package.json dependencies', () => {
  it('API-only has core, database, auth, cli deps', () => {
    const pkg = JSON.parse(getTemplates(makeCtx())['package.json']!)
    expect(pkg.dependencies['@mantiq/core']).toBeDefined()
    expect(pkg.dependencies['@mantiq/database']).toBeDefined()
    expect(pkg.dependencies['@mantiq/auth']).toBeDefined()
    expect(pkg.dependencies['@mantiq/cli']).toBeDefined()
  })

  it('API-only has events, queue, logging, validation deps', () => {
    const pkg = JSON.parse(getTemplates(makeCtx())['package.json']!)
    expect(pkg.dependencies['@mantiq/events']).toBeDefined()
    expect(pkg.dependencies['@mantiq/queue']).toBeDefined()
    expect(pkg.dependencies['@mantiq/logging']).toBeDefined()
    expect(pkg.dependencies['@mantiq/validation']).toBeDefined()
  })

  it('API-only has helpers, filesystem, heartbeat deps', () => {
    const pkg = JSON.parse(getTemplates(makeCtx())['package.json']!)
    expect(pkg.dependencies['@mantiq/helpers']).toBeDefined()
    expect(pkg.dependencies['@mantiq/filesystem']).toBeDefined()
    expect(pkg.dependencies['@mantiq/heartbeat']).toBeDefined()
  })

  it('API-only has mail, notify, search, health deps', () => {
    const pkg = JSON.parse(getTemplates(makeCtx())['package.json']!)
    expect(pkg.dependencies['@mantiq/mail']).toBeDefined()
    expect(pkg.dependencies['@mantiq/notify']).toBeDefined()
    expect(pkg.dependencies['@mantiq/search']).toBeDefined()
    expect(pkg.dependencies['@mantiq/health']).toBeDefined()
  })

  it('API-only does NOT have @mantiq/vite dep', () => {
    const pkg = JSON.parse(getTemplates(makeCtx())['package.json']!)
    expect(pkg.dependencies['@mantiq/vite']).toBeUndefined()
  })

  it('kit templates add @mantiq/vite dep', () => {
    for (const kit of ['react', 'vue', 'svelte'] as const) {
      const pkg = JSON.parse(getTemplates(makeCtx({ kit }))['package.json']!)
      expect(pkg.dependencies['@mantiq/vite']).toBeDefined()
    }
  })
})

// ── .env and APP_KEY ────────────────────────────────────────────────────────

describe('create-mantiq — .env', () => {
  it('.env has APP_KEY with base64 prefix', () => {
    const templates = getTemplates(makeCtx())
    expect(templates['.env']).toContain('APP_KEY=base64:')
  })

  it('.env has the exact appKey from context', () => {
    const ctx = makeCtx({ appKey: 'base64:myCustomKey123==' })
    const templates = getTemplates(ctx)
    expect(templates['.env']).toContain('APP_KEY=base64:myCustomKey123==')
  })

  it('.env.example has empty APP_KEY', () => {
    const templates = getTemplates(makeCtx())
    expect(templates['.env.example']).toContain('APP_KEY=\n')
  })

  it('.env has APP_NAME matching project name', () => {
    const templates = getTemplates(makeCtx({ name: 'my-cool-app' }))
    expect(templates['.env']).toContain('APP_NAME=my-cool-app')
  })

  it('kit .env includes VITE_DEV_SERVER_URL', () => {
    const templates = getTemplates(makeCtx({ kit: 'react' }))
    expect(templates['.env']).toContain('VITE_DEV_SERVER_URL=http://localhost:5173')
  })

  it('API-only .env does not include VITE_DEV_SERVER_URL', () => {
    const templates = getTemplates(makeCtx())
    expect(templates['.env']).not.toContain('VITE_DEV_SERVER_URL')
  })
})

// ── config/database.ts ──────────────────────────────────────────────────────

describe('create-mantiq — config/database.ts', () => {
  it('uses SQLite as default connection', () => {
    const templates = getTemplates(makeCtx())
    const dbConfig = templates['config/database.ts']!
    expect(dbConfig).toContain("default: env('DB_CONNECTION', 'sqlite')")
  })

  it('has SQLite connection config', () => {
    const templates = getTemplates(makeCtx())
    const dbConfig = templates['config/database.ts']!
    expect(dbConfig).toContain("driver: 'sqlite' as const")
  })
})

// ── config/auth.ts ──────────────────────────────────────────────────────────

describe('create-mantiq — config/auth.ts', () => {
  it('has web guard', () => {
    const templates = getTemplates(makeCtx())
    const authConfig = templates['config/auth.ts']!
    expect(authConfig).toContain("web: { driver: 'session'")
  })

  it('has api guard', () => {
    const templates = getTemplates(makeCtx())
    const authConfig = templates['config/auth.ts']!
    expect(authConfig).toContain("api: { driver: 'token'")
  })

  it('defaults to web guard', () => {
    const templates = getTemplates(makeCtx())
    const authConfig = templates['config/auth.ts']!
    expect(authConfig).toContain("guard: 'web'")
  })

  it('references User model', () => {
    const templates = getTemplates(makeCtx())
    const authConfig = templates['config/auth.ts']!
    expect(authConfig).toContain('import { User }')
    expect(authConfig).toContain('model: User')
  })
})

// ── index.ts imports ────────────────────────────────────────────────────────

describe('create-mantiq — index.ts service providers', () => {
  it('imports all core service providers (API-only)', () => {
    const templates = getTemplates(makeCtx())
    const index = templates['index.ts']!
    expect(index).toContain('CoreServiceProvider')
    expect(index).toContain('AuthServiceProvider')
    expect(index).toContain('FilesystemServiceProvider')
    expect(index).toContain('LoggingServiceProvider')
    expect(index).toContain('EventServiceProvider')
    expect(index).toContain('QueueServiceProvider')
    expect(index).toContain('ValidationServiceProvider')
    expect(index).toContain('HeartbeatServiceProvider')
    expect(index).toContain('RealtimeServiceProvider')
    expect(index).toContain('MailServiceProvider')
    expect(index).toContain('NotificationServiceProvider')
    expect(index).toContain('SearchServiceProvider')
    expect(index).toContain('DatabaseServiceProvider')
  })

  it('API-only index.ts does not import ViteServiceProvider', () => {
    const templates = getTemplates(makeCtx())
    expect(templates['index.ts']).not.toContain('ViteServiceProvider')
  })

  it('kit index.ts imports ViteServiceProvider', () => {
    const templates = getTemplates(makeCtx({ kit: 'react' }))
    expect(templates['index.ts']).toContain('ViteServiceProvider')
  })

  it('index.ts guards server startup with import.meta.main', () => {
    const templates = getTemplates(makeCtx())
    expect(templates['index.ts']).toContain('import.meta.main')
  })
})

// ── mantiq.ts CLI commands ──────────────────────────────────────────────────

describe('create-mantiq — mantiq.ts CLI', () => {
  it('registers migration commands', () => {
    const templates = getTemplates(makeCtx())
    const mantiq = templates['mantiq.ts']!
    expect(mantiq).toContain('MigrateCommand')
    expect(mantiq).toContain('MigrateRollbackCommand')
    expect(mantiq).toContain('MigrateResetCommand')
    expect(mantiq).toContain('MigrateFreshCommand')
    expect(mantiq).toContain('MigrateStatusCommand')
  })

  it('registers seed command', () => {
    const templates = getTemplates(makeCtx())
    expect(templates['mantiq.ts']).toContain('SeedCommand')
  })

  it('registers code generator commands', () => {
    const templates = getTemplates(makeCtx())
    const mantiq = templates['mantiq.ts']!
    expect(mantiq).toContain('MakeModelCommand')
    expect(mantiq).toContain('MakeControllerCommand')
    expect(mantiq).toContain('MakeMigrationCommand')
    expect(mantiq).toContain('MakeMiddlewareCommand')
    expect(mantiq).toContain('MakeSeederCommand')
    expect(mantiq).toContain('MakeFactoryCommand')
  })

  it('registers queue commands', () => {
    const templates = getTemplates(makeCtx())
    const mantiq = templates['mantiq.ts']!
    expect(mantiq).toContain('QueueWorkCommand')
    expect(mantiq).toContain('QueueRetryCommand')
    expect(mantiq).toContain('QueueFailedCommand')
    expect(mantiq).toContain('QueueFlushCommand')
  })

  it('registers utility commands', () => {
    const templates = getTemplates(makeCtx())
    const mantiq = templates['mantiq.ts']!
    expect(mantiq).toContain('AboutCommand')
    expect(mantiq).toContain('ServeCommand')
    expect(mantiq).toContain('RouteListCommand')
    expect(mantiq).toContain('TinkerCommand')
  })

  it('imports Kernel from @mantiq/cli', () => {
    const templates = getTemplates(makeCtx())
    expect(templates['mantiq.ts']).toContain("import { Kernel } from '@mantiq/cli'")
  })

  it('exits with kernel run code', () => {
    const templates = getTemplates(makeCtx())
    expect(templates['mantiq.ts']).toContain('process.exit(code)')
  })
})

// ── Scaffold Structure (write to temp dir) ──────────────────────────────────

describe('create-mantiq — scaffold structure (temp dir)', () => {
  let dir: string

  beforeEach(() => {
    dir = scaffoldToDir(makeCtx())
  })

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // cleanup best-effort
    }
  })

  it('creates all expected directories', () => {
    const files = collectFiles(dir)
    const dirs = new Set(files.map(f => dirname(f)))

    expect(dirs.has('config')).toBe(true)
    expect(dirs.has('routes')).toBe(true)
    expect(dirs.has('app/Models')).toBe(true)
    expect(dirs.has('app/Http/Controllers')).toBe(true)
    expect(dirs.has('database/migrations')).toBe(true)
    expect(dirs.has('database/seeders')).toBe(true)
  })

  it('no empty files except .gitkeep', () => {
    const files = collectFiles(dir)
    for (const file of files) {
      const fullPath = join(dir, file)
      const stat = statSync(fullPath)
      if (stat.size === 0) {
        expect(file).toEndWith('.gitkeep')
      }
    }
  })

  it('TypeScript files are syntactically valid', () => {
    const files = collectFiles(dir).filter(f => f.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const content = readFileSync(join(dir, file), 'utf-8')
      // Basic syntax checks: no unclosed braces at file level,
      // non-empty content, valid import/export statements
      expect(content.length).toBeGreaterThan(0)

      // Verify that opening and closing braces are balanced
      const opens = (content.match(/\{/g) || []).length
      const closes = (content.match(/\}/g) || []).length
      expect(opens).toBe(closes)

      // Verify that opening and closing parens are balanced
      const openParens = (content.match(/\(/g) || []).length
      const closeParens = (content.match(/\)/g) || []).length
      expect(openParens).toBe(closeParens)

      // Verify that opening and closing brackets are balanced
      const openBrackets = (content.match(/\[/g) || []).length
      const closeBrackets = (content.match(/\]/g) || []).length
      expect(openBrackets).toBe(closeBrackets)
    }
  })
})

describe('create-mantiq — scaffold structure: React kit (temp dir)', () => {
  let dir: string

  beforeEach(() => {
    dir = scaffoldToDir(makeCtx({ kit: 'react' }))
  })

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // cleanup best-effort
    }
  })

  it('creates storage and database directories', () => {
    const files = collectFiles(dir)
    const dirs = new Set(files.map(f => dirname(f)))

    expect(dirs.has('config')).toBe(true)
    expect(dirs.has('routes')).toBe(true)
    expect(dirs.has('database/migrations')).toBe(true)
    expect(dirs.has('storage/app')).toBe(true)
    expect(dirs.has('storage/logs')).toBe(true)
  })

  it('includes .gitignore with public/build and bootstrap', () => {
    const content = readFileSync(join(dir, '.gitignore'), 'utf-8')
    expect(content).toContain('public/build/')
    expect(content).toContain('bootstrap/')
  })

  it('TypeScript files have balanced syntax in React kit', () => {
    const files = collectFiles(dir).filter(f => f.endsWith('.ts'))
    for (const file of files) {
      const content = readFileSync(join(dir, file), 'utf-8')
      expect(content.length).toBeGreaterThan(0)

      const opens = (content.match(/\{/g) || []).length
      const closes = (content.match(/\}/g) || []).length
      expect(opens).toBe(closes)
    }
  })
})
