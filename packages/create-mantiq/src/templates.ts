export interface TemplateContext {
  name: string
  appKey: string
  kit?: 'react' | 'vue' | 'svelte'
  ui?: 'shadcn' | 'none'
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
        '@mantiq/auth': '^0.2.0',
        '@mantiq/cli': '^0.1.6',
        '@mantiq/core': '^0.3.0',
        '@mantiq/database': '^0.1.4',
        '@mantiq/events': '^0.1.2',
        '@mantiq/filesystem': '^0.1.2',
        '@mantiq/heartbeat': '^0.3.0',
        '@mantiq/helpers': '^0.1.2',
        '@mantiq/logging': '^0.1.2',
        '@mantiq/queue': '^0.1.2',
        '@mantiq/realtime': '^0.1.2',
        '@mantiq/validation': '^0.1.2',
        '@mantiq/mail': '^0.2.0',
        '@mantiq/notify': '^0.1.0',
        '@mantiq/search': '^0.1.0',
        '@mantiq/health': '^0.1.0',
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
MAIL_MAILER=log
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
import { AuthServiceProvider, Authenticate, RedirectIfAuthenticated, CheckAbilities, CheckForAnyAbility } from '@mantiq/auth'
import { FilesystemServiceProvider } from '@mantiq/filesystem'
import { LoggingServiceProvider } from '@mantiq/logging'
import { EventServiceProvider } from '@mantiq/events'
import { QueueServiceProvider } from '@mantiq/queue'
import { ValidationServiceProvider } from '@mantiq/validation'
import { HeartbeatServiceProvider, HeartbeatMiddleware } from '@mantiq/heartbeat'
import { RealtimeServiceProvider } from '@mantiq/realtime'
import { MailServiceProvider } from '@mantiq/mail'
import { NotificationServiceProvider } from '@mantiq/notify'
import { SearchServiceProvider } from '@mantiq/search'
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
  MailServiceProvider,
  NotificationServiceProvider,
  SearchServiceProvider,
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
kernel.registerMiddleware('abilities', CheckAbilities)
kernel.registerMiddleware('ability', CheckForAnyAbility)

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
import { MakeMailCommand } from '@mantiq/mail'
import { MakeNotificationCommand } from '@mantiq/notify'

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
  new MakeMailCommand(),
  new MakeNotificationCommand(),

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
    api: { driver: 'token', provider: 'users' },
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

    'config/mail.ts': `import { env } from '@mantiq/core'

export default {
  default: env('MAIL_MAILER', 'log'),

  from: {
    address: env('MAIL_FROM_ADDRESS', 'hello@example.com'),
    name: env('MAIL_FROM_NAME', '${ctx.name}'),
  },

  mailers: {
    smtp: {
      driver: 'smtp' as const,
      host: env('MAIL_HOST', 'localhost'),
      port: Number(env('MAIL_PORT', '587')),
      username: env('MAIL_USERNAME', ''),
      password: env('MAIL_PASSWORD', ''),
      encryption: env('MAIL_ENCRYPTION', 'starttls') as 'tls' | 'starttls' | 'none',
    },

    resend: {
      driver: 'resend' as const,
      apiKey: env('RESEND_API_KEY', ''),
    },

    sendgrid: {
      driver: 'sendgrid' as const,
      apiKey: env('SENDGRID_API_KEY', ''),
    },

    mailgun: {
      driver: 'mailgun' as const,
      apiKey: env('MAILGUN_API_KEY', ''),
      domain: env('MAILGUN_DOMAIN', ''),
    },

    postmark: {
      driver: 'postmark' as const,
      serverToken: env('POSTMARK_TOKEN', ''),
    },

    ses: {
      driver: 'ses' as const,
      region: env('AWS_REGION', 'us-east-1'),
      accessKeyId: env('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY', ''),
    },

    log: { driver: 'log' as const },
    array: { driver: 'array' as const },
  },
}
`,

    'config/notify.ts': `export default {
  channels: {},
}
`,

    'config/search.ts': `export default {
  default: 'collection',
  prefix: '',
  queue: false,
  softDelete: false,

  engines: {
    collection: {
      driver: 'collection' as const,
    },
    database: {
      driver: 'database' as const,
    },
    // algolia: {
    //   driver: 'algolia' as const,
    //   applicationId: env('ALGOLIA_APP_ID', ''),
    //   apiKey: env('ALGOLIA_SECRET', ''),
    // },
    // meilisearch: {
    //   driver: 'meilisearch' as const,
    //   host: env('MEILISEARCH_HOST', 'http://127.0.0.1:7700'),
    //   apiKey: env('MEILISEARCH_KEY', ''),
    // },
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
import { config } from '@mantiq/core'

export class HomeController {
  async index(_request: MantiqRequest): Promise<Response> {
    const appName = config('app.name') ?? 'MantiqJS'
    const appEnv = config('app.env') ?? 'production'
    const debug = config('app.debug') ? 'Enabled' : 'Disabled'
    const bunVersion = typeof Bun !== 'undefined' ? Bun.version : 'unknown'

    let mantiqVersion = '0.0.0'
    try {
      const pkg = await Bun.file(require.resolve('@mantiq/core/package.json')).json()
      mantiqVersion = pkg.version
    } catch { /* fallback */ }

    const html = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${appName}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      background:#0a0a0b;color:#fafafa;min-height:100vh;
      display:flex;align-items:center;justify-content:center;
      -webkit-font-smoothing:antialiased;
    }
    .c{width:100%;max-width:460px;padding:32px;animation:up .5s ease}
    @keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .w{font-size:28px;font-weight:600;letter-spacing:-0.04em;color:#fafafa}
    .w .d{color:#10b981}
    .v{font-family:'SF Mono',ui-monospace,monospace;font-size:12px;color:#52525b;margin-top:6px}
    hr{border:none;border-top:1px solid #1e1e1e;margin:24px 0}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .l{
      background:#111113;border:1px solid #1e1e1e;border-radius:8px;
      padding:14px 16px;text-decoration:none;color:#a1a1aa;font-size:13px;
      display:flex;align-items:center;justify-content:space-between;
      transition:border-color .15s,color .15s;
    }
    .l:hover{border-color:#27272a;color:#34d399}
    .l .a{color:#52525b;font-size:11px;transition:color .15s}
    .l:hover .a{color:#34d399}
    .e{
      margin-top:24px;font-family:'SF Mono',ui-monospace,monospace;
      font-size:11px;color:#3f3f46;line-height:2;
    }
    .e span{color:#52525b}
  </style>
</head>
<body>
  <div class="c">
    <div class="w"><span class="d">.</span>mantiq</div>
    <div class="v">v\${mantiqVersion} — \${appName}</div>
    <hr>
    <div class="g">
      <a class="l" href="/_heartbeat">Heartbeat<span class="a">&rarr;</span></a>
      <a class="l" href="/api/ping">API Ping<span class="a">&rarr;</span></a>
      <a class="l" href="https://github.com/mantiqjs/mantiq" target="_blank" rel="noopener">GitHub<span class="a">&nearr;</span></a>
      <a class="l" href="https://www.npmjs.com/org/mantiq" target="_blank" rel="noopener">npm<span class="a">&nearr;</span></a>
    </div>
    <div class="e">
      <span>Runtime</span> Bun \${bunVersion}<br>
      <span>Environment</span> \${appEnv}<br>
      <span>Debug</span> \${debug}
    </div>
  </div>
</body>
</html>\`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
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

    'app/Models/PersonalAccessToken.ts': `import { PersonalAccessToken as BaseToken } from '@mantiq/auth'

// Re-export the built-in PersonalAccessToken.
// Extend this class if you need to add custom logic.
export class PersonalAccessToken extends BaseToken {}
`,

    'app/Providers/DatabaseServiceProvider.ts': `import { ServiceProvider, config } from '@mantiq/core'
import { DatabaseManager, setupModels, setManager, Migrator } from '@mantiq/database'
import { applyHasApiTokens, PersonalAccessToken } from '@mantiq/auth'
import { User } from '../Models/User.ts'

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
    const manager = this.app.make(DatabaseManager)

    // Set up PersonalAccessToken connection and apply HasApiTokens mixin
    PersonalAccessToken.setConnection(manager.connection())
    applyHasApiTokens(User)
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

    'database/migrations/002_create_personal_access_tokens_table.ts': `import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class CreatePersonalAccessTokensTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('personal_access_tokens', (t) => {
      t.id()
      t.string('tokenable_type')
      t.unsignedBigInteger('tokenable_id')
      t.string('name')
      t.string('token', 64).unique()
      t.json('abilities').nullable()
      t.timestamp('last_used_at').nullable()
      t.timestamp('expires_at').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('personal_access_tokens')
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

  // ── package.json ────────────────────────────────────────────────────────
  const frameworkDevDeps: Record<string, string> = kit === 'react'
    ? { 'react': '^19.0.0', 'react-dom': '^19.0.0', '@vitejs/plugin-react': '^6.0.0', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' }
    : kit === 'vue'
    ? { 'vue': '^3.5.0', '@vitejs/plugin-vue': '^6.0.0' }
    : { 'svelte': '^5.0.0', '@sveltejs/vite-plugin-svelte': '^7.0.0' }

  // UI library deps (shadcn + icons) — must match what the stubs actually import
  const uiDeps: Record<string, string> = kit === 'react'
    ? { 'clsx': '^2.1.0', 'tailwind-merge': '^2.6.0', 'class-variance-authority': '^0.7.1', 'lucide-react': '^0.577.0', 'radix-ui': '^1.4.0' }
    : kit === 'vue'
    ? { 'clsx': '^2.1.0', 'tailwind-merge': '^3.5.0', 'class-variance-authority': '^0.7.1', 'lucide-vue-next': '^0.577.0', 'reka-ui': '^2.9.0', 'tw-animate-css': '^1.4.0', '@tanstack/vue-table': '^8.0.0' }
    : { 'clsx': '^2.1.0', 'tailwind-merge': '^2.6.0', 'tailwind-variants': '^3.2.0', 'lucide-svelte': '^0.577.0', '@lucide/svelte': '^0.577.0', 'bits-ui': '^2.16.0' }

  templates['package.json'] = JSON.stringify({
    name: ctx.name,
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts: {
      dev: 'bun run dev:backend & bun run dev:frontend & wait',
      'dev:backend': 'bun run --watch index.ts',
      'dev:frontend': 'bunx vite --clearScreen false',
      start: 'bun run index.ts',
      mantiq: 'bun run mantiq.ts',
      build: `vite build && vite build --ssr ${kit === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts'} --outDir bootstrap/ssr`,
      setup: 'bun install && bun mantiq migrate && bun mantiq seed && bun run build',
      postinstall: 'rm -rf node_modules/@mantiq/*/node_modules/@mantiq 2>/dev/null; true',
    },
    dependencies: {
      '@mantiq/auth': '^0.2.0',
      '@mantiq/cli': '^0.1.6',
      '@mantiq/core': '^0.3.0',
      '@mantiq/database': '^0.1.4',
      '@mantiq/events': '^0.1.2',
      '@mantiq/filesystem': '^0.1.2',
      '@mantiq/heartbeat': '^0.3.0',
      '@mantiq/helpers': '^0.1.2',
      '@mantiq/logging': '^0.1.2',
      '@mantiq/queue': '^0.1.2',
      '@mantiq/realtime': '^0.1.2',
      '@mantiq/validation': '^0.1.2',
      '@mantiq/mail': '^0.2.0',
      '@mantiq/notify': '^0.1.0',
      '@mantiq/search': '^0.1.0',
      '@mantiq/health': '^0.1.0',
      '@mantiq/vite': '^0.1.3',
      ...uiDeps,
    },
    devDependencies: {
      'bun-types': 'latest',
      'typescript': '^5.7.0',
      'vite': '^8.0.0',
      'tailwindcss': '^4.0.0',
      '@tailwindcss/vite': '^4.0.0',
      ...frameworkDevDeps,
    },
  }, null, 2) + '\n'

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
import { AuthServiceProvider, Authenticate, RedirectIfAuthenticated, CheckAbilities, CheckForAnyAbility } from '@mantiq/auth'
import { FilesystemServiceProvider } from '@mantiq/filesystem'
import { LoggingServiceProvider } from '@mantiq/logging'
import { EventServiceProvider } from '@mantiq/events'
import { QueueServiceProvider } from '@mantiq/queue'
import { ValidationServiceProvider } from '@mantiq/validation'
import { HeartbeatServiceProvider, HeartbeatMiddleware } from '@mantiq/heartbeat'
import { RealtimeServiceProvider } from '@mantiq/realtime'
import { MailServiceProvider } from '@mantiq/mail'
import { NotificationServiceProvider } from '@mantiq/notify'
import { SearchServiceProvider } from '@mantiq/search'
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
  MailServiceProvider,
  NotificationServiceProvider,
  SearchServiceProvider,
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
kernel.registerMiddleware('abilities', CheckAbilities)
kernel.registerMiddleware('ability', CheckForAnyAbility)

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
}
