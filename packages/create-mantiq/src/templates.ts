import { getReactTemplates } from './kits/react.ts'
import { getVueTemplates } from './kits/vue.ts'
import { getSvelteTemplates } from './kits/svelte.ts'

export interface TemplateContext {
  name: string
  appKey: string
  kit?: 'react' | 'vue' | 'svelte'
}

export function getTemplates(ctx: TemplateContext): Record<string, string> {
  const templates: Record<string, string> = {
    // ── Root files ──────────────────────────────────────────────────────────

    'package.json': JSON.stringify({
      name: ctx.name,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        dev: 'bun run --watch index.ts',
        start: 'bun run index.ts',
        mantiq: 'bun run mantiq.ts',
      },
      dependencies: {
        '@mantiq/auth': '^0.1.2',
        '@mantiq/cli': '^0.1.2',
        '@mantiq/core': '^0.1.2',
        '@mantiq/database': '^0.1.2',
        '@mantiq/events': '^0.1.2',
        '@mantiq/filesystem': '^0.1.2',
        '@mantiq/heartbeat': '^0.1.2',
        '@mantiq/helpers': '^0.1.2',
        '@mantiq/logging': '^0.1.2',
        '@mantiq/queue': '^0.1.2',
        '@mantiq/realtime': '^0.1.2',
        '@mantiq/validation': '^0.1.2',
      },
      devDependencies: {
        'bun-types': 'latest',
        'typescript': '^5.7.0',
      },
    }, null, 2) + '\n',

    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ESNext'],
        types: ['bun-types'],
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        allowImportingTsExtensions: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ['./**/*'],
      exclude: ['node_modules'],
    }, null, 2) + '\n',

    '.env': `APP_NAME=${ctx.name}
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000
APP_PORT=3000
APP_KEY=${ctx.appKey}

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

LOG_CHANNEL=stack
QUEUE_CONNECTION=sync
`,

    '.env.example': `APP_NAME=${ctx.name}
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000
APP_PORT=3000
APP_KEY=

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

LOG_CHANNEL=stack
QUEUE_CONNECTION=sync
`,

    '.gitignore': `node_modules/
dist/
*.sqlite
*.sqlite-journal
*.sqlite-wal
*.sqlite-shm
.env
.DS_Store
tsconfig.tsbuildinfo
storage/logs/
storage/app/
storage/heartbeat/
`,

    // ── Entry points ────────────────────────────────────────────────────────

    'index.ts': `import { Application, CoreServiceProvider, HttpKernel, RouterImpl, CorsMiddleware, StartSession, EncryptCookies, VerifyCsrfToken } from '@mantiq/core'
import { AuthServiceProvider, Authenticate, RedirectIfAuthenticated } from '@mantiq/auth'
import { FilesystemServiceProvider } from '@mantiq/filesystem'
import { LoggingServiceProvider } from '@mantiq/logging'
import { EventServiceProvider } from '@mantiq/events'
import { QueueServiceProvider } from '@mantiq/queue'
import { ValidationServiceProvider } from '@mantiq/validation'
import { HeartbeatServiceProvider, HeartbeatMiddleware } from '@mantiq/heartbeat'
import { RealtimeServiceProvider } from '@mantiq/realtime'
import { DatabaseServiceProvider } from './app/Providers/DatabaseServiceProvider.ts'

// ── Load .env ─────────────────────────────────────────────────────────────────
const envFile = Bun.file(import.meta.dir + '/.env')
if (await envFile.exists()) {
  const text = await envFile.text()
  for (const line of text.split('\\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = value
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = await Application.create(import.meta.dir, 'config')

await app.registerProviders([
  CoreServiceProvider,
  DatabaseServiceProvider,
  AuthServiceProvider,
  FilesystemServiceProvider,
  LoggingServiceProvider,
  EventServiceProvider,
  QueueServiceProvider,
  ValidationServiceProvider,
  HeartbeatServiceProvider,
  RealtimeServiceProvider,
])
await app.bootProviders()

// ── Kernel setup ──────────────────────────────────────────────────────────────
const kernel = app.make(HttpKernel)
const router = app.make(RouterImpl)

// Register middleware aliases
kernel.registerMiddleware('cors', CorsMiddleware)
kernel.registerMiddleware('encrypt.cookies', EncryptCookies)
kernel.registerMiddleware('session', StartSession)
kernel.registerMiddleware('csrf', VerifyCsrfToken)
kernel.registerMiddleware('auth', Authenticate)
kernel.registerMiddleware('guest', RedirectIfAuthenticated)
kernel.registerMiddleware('heartbeat', HeartbeatMiddleware)

// Global middleware
kernel.setGlobalMiddleware(['cors', 'encrypt.cookies', 'session', 'heartbeat'])

// ── Routes ────────────────────────────────────────────────────────────────────
import webRoutes from './routes/web.ts'
import apiRoutes from './routes/api.ts'

webRoutes(router)
apiRoutes(router)

// ── Export for CLI ────────────────────────────────────────────────────────────
export default app

// ── Start ─────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  await kernel.start()
}
`,

    'mantiq.ts': `#!/usr/bin/env bun
await import('./index.ts')

import { Kernel } from '@mantiq/cli'
import {
  AboutCommand,
  MigrateCommand,
  MigrateRollbackCommand,
  MigrateResetCommand,
  MigrateFreshCommand,
  MigrateStatusCommand,
  SeedCommand,
  MakeCommandCommand,
  MakeControllerCommand,
  MakeEventCommand,
  MakeExceptionCommand,
  MakeFactoryCommand,
  MakeListenerCommand,
  MakeMiddlewareCommand,
  MakeMigrationCommand,
  MakeModelCommand,
  MakeObserverCommand,
  MakeProviderCommand,
  MakeRequestCommand,
  MakeRuleCommand,
  MakeSeederCommand,
  MakeTestCommand,
  ServeCommand,
  RouteListCommand,
  TinkerCommand,
} from '@mantiq/cli'
import {
  QueueWorkCommand,
  QueueRetryCommand,
  QueueFailedCommand,
  QueueFlushCommand,
  MakeJobCommand,
  ScheduleRunCommand,
} from '@mantiq/queue'
import { InstallCommand as HeartbeatInstallCommand } from '@mantiq/heartbeat'

const kernel = new Kernel()

kernel.registerAll([
  // Database
  new MigrateCommand(),
  new MigrateRollbackCommand(),
  new MigrateResetCommand(),
  new MigrateFreshCommand(),
  new MigrateStatusCommand(),
  new SeedCommand(),

  // Code generators
  new MakeCommandCommand(),
  new MakeControllerCommand(),
  new MakeEventCommand(),
  new MakeExceptionCommand(),
  new MakeFactoryCommand(),
  new MakeJobCommand(),
  new MakeListenerCommand(),
  new MakeMiddlewareCommand(),
  new MakeMigrationCommand(),
  new MakeModelCommand(),
  new MakeObserverCommand(),
  new MakeProviderCommand(),
  new MakeRequestCommand(),
  new MakeRuleCommand(),
  new MakeSeederCommand(),
  new MakeTestCommand(),

  // Queue
  new QueueWorkCommand(),
  new QueueRetryCommand(),
  new QueueFailedCommand(),
  new QueueFlushCommand(),
  new ScheduleRunCommand(),

  // Utilities
  new AboutCommand(),
  new ServeCommand(),
  new RouteListCommand(),
  new TinkerCommand(),

  // Heartbeat
  new HeartbeatInstallCommand(),
])

const code = await kernel.run()
process.exit(code)
`,

    // ── Config ──────────────────────────────────────────────────────────────

    'config/app.ts': `import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'MantiqJS'),
  env: env('APP_ENV', 'production'),
  debug: env('APP_DEBUG', false),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3000'),
  port: Number(env('APP_PORT', '3000')),
  basePath: import.meta.dir + '/..',
}
`,

    'config/database.ts': `import { env } from '@mantiq/core'

export default {
  default: env('DB_CONNECTION', 'sqlite'),

  connections: {
    sqlite: {
      driver: 'sqlite' as const,
      database: env('DB_DATABASE', import.meta.dir + '/../database/database.sqlite'),
    },
  },
}
`,

    'config/auth.ts': `import { User } from '../app/Models/User.ts'

export default {
  defaults: {
    guard: 'web',
  },

  guards: {
    web: { driver: 'session', provider: 'users' },
  },

  providers: {
    users: { driver: 'database', model: User },
  },
}
`,

    'config/filesystem.ts': `import { env } from '@mantiq/core'

export default {
  default: env('FILESYSTEM_DISK', 'local'),

  disks: {
    local: {
      driver: 'local' as const,
      root: import.meta.dir + '/../storage/app',
    },
    public: {
      driver: 'local' as const,
      root: import.meta.dir + '/../storage/app/public',
      visibility: 'public' as const,
    },
  },
}
`,

    'config/logging.ts': `import { env } from '@mantiq/core'

export default {
  default: env('LOG_CHANNEL', 'stack'),

  channels: {
    stack: {
      driver: 'stack' as const,
      channels: ['console', 'daily'],
    },
    console: {
      driver: 'console' as const,
      level: 'debug' as const,
    },
    daily: {
      driver: 'daily' as const,
      path: 'storage/logs/mantiq.log',
      level: 'debug' as const,
      days: 14,
    },
    file: {
      driver: 'file' as const,
      path: 'storage/logs/mantiq.log',
      level: 'debug' as const,
    },
  },
}
`,

    'config/queue.ts': `import { env } from '@mantiq/core'

export default {
  default: env('QUEUE_CONNECTION', 'sync'),

  connections: {
    sync: {
      driver: 'sync' as const,
    },
    sqlite: {
      driver: 'sqlite' as const,
      database: import.meta.dir + '/../database/queue.sqlite',
      table: 'jobs',
      retryAfter: 60,
    },
  },

  failed: {
    driver: 'sqlite' as const,
    database: import.meta.dir + '/../database/queue.sqlite',
    table: 'failed_jobs',
  },
}
`,

    'config/heartbeat.ts': `export default {
  enabled: true,

  storage: {
    driver: 'sqlite' as const,
    path: 'storage/heartbeat/heartbeat.sqlite',
    retention: 86400,   // 24 hours
    pruneInterval: 300,  // 5 minutes
  },

  queue: {
    connection: 'sync',
    queue: 'heartbeat',
    batchSize: 50,
    flushInterval: 1000,
  },

  watchers: {
    request:   { enabled: true, slow_threshold: 1000, ignore: [] },
    query:     { enabled: true, slow_threshold: 100, detect_n_plus_one: true },
    exception: { enabled: true, ignore: [] },
    cache:     { enabled: true },
    job:       { enabled: true },
    event:     { enabled: true, ignore: [] },
    model:     { enabled: true },
    log:       { enabled: true, level: 'debug' },
    schedule:  { enabled: true },
  },

  tracing: {
    enabled: true,
    propagate: true,
  },

  sampling: {
    rate: 1.0,
    always_sample_errors: true,
  },

  dashboard: {
    enabled: true,
    path: '/_heartbeat',
    middleware: [],
  },
}
`,

    // ── Storage ─────────────────────────────────────────────────────────────

    'storage/app/.gitkeep': '',
    'storage/logs/.gitkeep': '',

    // ── Routes ──────────────────────────────────────────────────────────────

    'routes/web.ts': `import type { Router } from '@mantiq/core'
import { HomeController } from '../app/Http/Controllers/HomeController.ts'

export default function (router: Router) {
  router.get('/', [HomeController, 'index'])
}
`,

    'routes/api.ts': `import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

export default function (router: Router) {
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })
}
`,

    // ── App ─────────────────────────────────────────────────────────────────

    'app/Http/Controllers/HomeController.ts': `import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, config } from '@mantiq/core'

export class HomeController {
  async index(_request: MantiqRequest): Promise<Response> {
    return MantiqResponse.json({
      message: \`Welcome to \${config('app.name')}!\`,
      version: '0.0.1',
    })
  }
}
`,

    'app/Http/Middleware/.gitkeep': '',

    'app/Models/User.ts': `import { Model } from '@mantiq/database'
import type { Authenticatable } from '@mantiq/auth'

export class User extends Model implements Authenticatable {
  static override table = 'users'
  static override fillable = ['name', 'email', 'password']
  static override guarded = ['id']
  static override hidden = ['password', 'remember_token']
  static override timestamps = true

  getAuthIdentifierName(): string { return 'id' }
  getAuthIdentifier(): number { return this.getAttribute('id') as number }
  getAuthPasswordName(): string { return 'password' }
  getAuthPassword(): string { return this.getAttribute('password') as string }
  getRememberToken(): string | null { return (this.getAttribute('remember_token') as string) ?? null }
  setRememberToken(token: string | null): void { this.setAttribute('remember_token', token) }
  getRememberTokenName(): string { return 'remember_token' }
}
`,

    'app/Providers/DatabaseServiceProvider.ts': `import { ServiceProvider, config } from '@mantiq/core'
import { DatabaseManager, setupModels, setManager, Migrator } from '@mantiq/database'

export class DatabaseServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(DatabaseManager, () => {
      const dbConfig = config('database')
      const manager = new DatabaseManager(dbConfig)

      setManager(manager)
      setupModels(manager)

      return manager
    })
  }

  override async boot(): Promise<void> {
    // Resolve the manager (triggers creation via the singleton factory)
    this.app.make(DatabaseManager)
  }
}
`,

    // ── Database ────────────────────────────────────────────────────────────

    'database/migrations/001_create_users_table.ts': `import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreateUsersTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('users', (t) => {
      t.id()
      t.string('name', 100)
      t.string('email', 150).unique()
      t.string('password', 255)
      t.string('remember_token', 100).nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('users')
  }
}
`,

    'database/seeders/DatabaseSeeder.ts': `import { Seeder } from '@mantiq/database'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    // await this.call(UserSeeder)
  }
}
`,

    'database/factories/.gitkeep': '',

    'public/.gitkeep': '',
  }

  // Apply starter kit overrides
  if (ctx.kit) {
    applyKitOverrides(templates, ctx)
  }

  return templates
}

// ── Starter Kit Overrides ────────────────────────────────────────────────────

function applyKitOverrides(templates: Record<string, string>, ctx: TemplateContext): void {
  const kit = ctx.kit!
  const mainEntry = kit === 'react' ? 'src/main.tsx' : 'src/main.ts'

  // ── package.json ────────────────────────────────────────────────────────
  const frameworkDevDeps: Record<string, string> = kit === 'react'
    ? { 'react': '^19.0.0', 'react-dom': '^19.0.0', '@vitejs/plugin-react': '^4.0.0', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' }
    : kit === 'vue'
    ? { 'vue': '^3.5.0', '@vitejs/plugin-vue': '^5.0.0' }
    : { 'svelte': '^4.0.0', '@sveltejs/vite-plugin-svelte': '^3.0.0' }

  templates['package.json'] = JSON.stringify({
    name: ctx.name,
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts: {
      dev: 'bun run --watch index.ts',
      start: 'bun run index.ts',
      mantiq: 'bun run mantiq.ts',
      'dev:frontend': 'vite',
      'build:frontend': `vite build && vite build --ssr ${kit === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts'} --outDir bootstrap/ssr`,
    },
    dependencies: {
      '@mantiq/auth': '^0.1.2',
      '@mantiq/cli': '^0.1.2',
      '@mantiq/core': '^0.1.2',
      '@mantiq/database': '^0.1.2',
      '@mantiq/events': '^0.1.2',
      '@mantiq/filesystem': '^0.1.2',
      '@mantiq/heartbeat': '^0.1.2',
      '@mantiq/helpers': '^0.1.2',
      '@mantiq/logging': '^0.1.2',
      '@mantiq/queue': '^0.1.2',
      '@mantiq/realtime': '^0.1.2',
      '@mantiq/validation': '^0.1.2',
      '@mantiq/vite': '^0.1.2',
    },
    devDependencies: {
      'bun-types': 'latest',
      'typescript': '^5.7.0',
      'vite': '^6.0.0',
      'tailwindcss': '^4.0.0',
      '@tailwindcss/vite': '^4.0.0',
      ...frameworkDevDeps,
    },
  }, null, 2) + '\n'

  // ── tsconfig.json (React needs JSX + DOM) ───────────────────────────────
  if (kit === 'react') {
    templates['tsconfig.json'] = JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ESNext', 'DOM', 'DOM.Iterable'],
        types: ['bun-types'],
        jsx: 'react-jsx',
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        allowImportingTsExtensions: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ['./**/*'],
      exclude: ['node_modules'],
    }, null, 2) + '\n'
  }

  // ── .env ────────────────────────────────────────────────────────────────
  templates['.env'] = `APP_NAME=${ctx.name}
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000
APP_PORT=3000
APP_KEY=${ctx.appKey}

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

LOG_CHANNEL=stack
QUEUE_CONNECTION=sync

VITE_DEV_SERVER_URL=http://localhost:5173
`

  templates['.env.example'] = `APP_NAME=${ctx.name}
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000
APP_PORT=3000
APP_KEY=

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

LOG_CHANNEL=stack
QUEUE_CONNECTION=sync

VITE_DEV_SERVER_URL=http://localhost:5173
`

  // ── .gitignore ──────────────────────────────────────────────────────────
  templates['.gitignore'] = `node_modules/
dist/
*.sqlite
*.sqlite-journal
*.sqlite-wal
*.sqlite-shm
.env
.DS_Store
tsconfig.tsbuildinfo
storage/logs/
storage/app/
storage/heartbeat/
public/build/
public/hot
bootstrap/
`

  // ── index.ts ────────────────────────────────────────────────────────────
  templates['index.ts'] = `import { Application, CoreServiceProvider, HttpKernel, RouterImpl, CorsMiddleware, StartSession, EncryptCookies, VerifyCsrfToken } from '@mantiq/core'
import { ViteServiceProvider, ServeStaticFiles } from '@mantiq/vite'
import { AuthServiceProvider, Authenticate, RedirectIfAuthenticated } from '@mantiq/auth'
import { FilesystemServiceProvider } from '@mantiq/filesystem'
import { LoggingServiceProvider } from '@mantiq/logging'
import { EventServiceProvider } from '@mantiq/events'
import { QueueServiceProvider } from '@mantiq/queue'
import { ValidationServiceProvider } from '@mantiq/validation'
import { HeartbeatServiceProvider, HeartbeatMiddleware } from '@mantiq/heartbeat'
import { RealtimeServiceProvider } from '@mantiq/realtime'
import { DatabaseServiceProvider } from './app/Providers/DatabaseServiceProvider.ts'

// ── Load .env ─────────────────────────────────────────────────────────────────
const envFile = Bun.file(import.meta.dir + '/.env')
if (await envFile.exists()) {
  const text = await envFile.text()
  for (const line of text.split('\\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = value
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = await Application.create(import.meta.dir, 'config')

await app.registerProviders([
  CoreServiceProvider,
  DatabaseServiceProvider,
  AuthServiceProvider,
  ViteServiceProvider,
  FilesystemServiceProvider,
  LoggingServiceProvider,
  EventServiceProvider,
  QueueServiceProvider,
  ValidationServiceProvider,
  HeartbeatServiceProvider,
  RealtimeServiceProvider,
])
await app.bootProviders()

// ── Seed default data (only when running the server directly) ────────────────
if (import.meta.main) {
  try {
    const UserSeeder = (await import('./database/seeders/UserSeeder.ts')).default
    await new UserSeeder().run()
  } catch {
    // Table may not exist yet — run: bun mantiq migrate
  }
}

// ── Kernel setup ──────────────────────────────────────────────────────────────
const kernel = app.make(HttpKernel)
const router = app.make(RouterImpl)

// Register middleware aliases
kernel.registerMiddleware('cors', CorsMiddleware)
kernel.registerMiddleware('static', ServeStaticFiles)
kernel.registerMiddleware('encrypt.cookies', EncryptCookies)
kernel.registerMiddleware('session', StartSession)
kernel.registerMiddleware('csrf', VerifyCsrfToken)
kernel.registerMiddleware('auth', Authenticate)
kernel.registerMiddleware('guest', RedirectIfAuthenticated)
kernel.registerMiddleware('heartbeat', HeartbeatMiddleware)

// Global middleware
kernel.setGlobalMiddleware(['static', 'cors', 'encrypt.cookies', 'session', 'heartbeat'])

// ── Routes ────────────────────────────────────────────────────────────────────
import webRoutes from './routes/web.ts'
import apiRoutes from './routes/api.ts'

webRoutes(router)
apiRoutes(router)

// ── Export for CLI ────────────────────────────────────────────────────────────
export default app

// ── Start ─────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  await kernel.start()
}
`

  // ── config/vite.ts ──────────────────────────────────────────────────────
  const ssrEntry = kit === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts'
  templates['config/vite.ts'] = `import { env } from '@mantiq/core'

export default {
  devServerUrl: env('VITE_DEV_SERVER_URL', 'http://localhost:5173'),
  buildDir: 'build',
  publicDir: import.meta.dir + '/../public',
  manifest: '.vite/manifest.json',
  reactRefresh: ${kit === 'react' ? 'true' : 'false'},
  rootElement: 'app',
  ssr: {
    entry: '${kit === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts'}',
    bundle: 'bootstrap/ssr/ssr.js',
  },
}
`

  // ── routes/web.ts ───────────────────────────────────────────────────────
  templates['routes/web.ts'] = `import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { PageController } from '../app/Http/Controllers/PageController.ts'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'

export default function (router: Router) {
  // Redirect root to dashboard
  router.get('/', () => MantiqResponse.redirect('/dashboard'))

  // Page routes — each returns HTML (first load) or JSON (client navigation)
  router.get('/dashboard', [PageController, 'dashboard']).middleware('auth')
  router.get('/login', [PageController, 'login']).middleware('guest')
  router.get('/register', [PageController, 'register']).middleware('guest')

  // Auth actions
  router.post('/login', [AuthController, 'login'])
  router.post('/register', [AuthController, 'register'])
  router.post('/logout', [AuthController, 'logout']).middleware('auth')
}
`

  // ── routes/api.ts ───────────────────────────────────────────────────────
  templates['routes/api.ts'] = `import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { User } from '../app/Models/User.ts'

export default function (router: Router) {
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  router.get('/api/users', async () => {
    const users = await User.all()
    return MantiqResponse.json({ data: users.map((u: any) => u.toObject()) })
  }).middleware('auth')
}
`

  // ── PageController (SSR + universal routing) ────────────────────────────
  templates['app/Http/Controllers/PageController.ts'] = `import type { MantiqRequest } from '@mantiq/core'
import { config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

export class PageController {
  async dashboard(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    const currentUser = user ? {
      id: (user as any).getAttribute?.('id') ?? user.getAuthIdentifier(),
      name: (user as any).getAttribute?.('name') ?? '',
      email: (user as any).getAttribute?.('email') ?? '',
    } : null

    const users = await User.all()

    return vite().render(request, {
      page: 'Dashboard',
      entry: ['src/style.css', '${mainEntry}'],
      title: config('app.name') + ' — Dashboard',
      data: {
        appName: config('app.name'),
        currentUser,
        users: users.map((u: any) => u.toObject()),
      },
    })
  }

  async login(request: MantiqRequest): Promise<Response> {
    return vite().render(request, {
      page: 'Login',
      entry: ['src/style.css', '${mainEntry}'],
      title: config('app.name') + ' — Sign In',
      data: { appName: config('app.name') },
    })
  }

  async register(request: MantiqRequest): Promise<Response> {
    return vite().render(request, {
      page: 'Register',
      entry: ['src/style.css', '${mainEntry}'],
      title: config('app.name') + ' — Register',
      data: { appName: config('app.name') },
    })
  }
}
`

  // ── AuthController ──────────────────────────────────────────────────────
  templates['app/Http/Controllers/AuthController.ts'] = `import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, HashManager } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

export class AuthController {
  async register(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as { name?: string; email?: string; password?: string }

    if (!body.name || !body.email || !body.password) {
      return MantiqResponse.json({ error: 'Name, email and password are required.' }, 422)
    }
    if (body.password.length < 6) {
      return MantiqResponse.json({ error: 'Password must be at least 6 characters.' }, 422)
    }

    const existing = await User.where('email', body.email).first()
    if (existing) {
      return MantiqResponse.json({ error: 'A user with this email already exists.' }, 422)
    }

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make(body.password)

    const user = await User.create({
      name: body.name,
      email: body.email,
      password: hashed,
    })

    const manager = auth()
    manager.setRequest(request)
    await manager.login(user as any)

    return MantiqResponse.json({ message: 'Registered.', user: user.toObject() }, 201)
  }

  async login(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as { email?: string; password?: string; remember?: boolean }

    if (!body.email || !body.password) {
      return MantiqResponse.json({ error: 'Email and password are required.' }, 422)
    }

    const manager = auth()
    manager.setRequest(request)

    const success = await manager.attempt(
      { email: body.email, password: body.password },
      body.remember ?? false,
    )

    if (!success) {
      return MantiqResponse.json({ error: 'Invalid credentials.' }, 401)
    }

    const user = await manager.user()
    return MantiqResponse.json({ message: 'Logged in.', user })
  }

  async logout(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    await manager.logout()
    return MantiqResponse.json({ message: 'Logged out.' })
  }
}
`

  // ── UserSeeder ──────────────────────────────────────────────────────────
  templates['database/seeders/UserSeeder.ts'] = `import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'

export default class UserSeeder extends Seeder {
  override async run() {
    const existing = await User.where('email', 'admin@example.com').first()
    if (existing) return

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: await hasher.make('password'),
    })
  }
}
`

  // ── Merge framework-specific files (vite.config.ts, src/*, etc.) ────────
  const kitTemplates = kit === 'react'
    ? getReactTemplates(ctx)
    : kit === 'vue'
    ? getVueTemplates(ctx)
    : getSvelteTemplates(ctx)

  Object.assign(templates, kitTemplates)
}
