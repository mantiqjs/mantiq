export interface TemplateContext {
  name: string
  appKey: string
}

export function getTemplates(ctx: TemplateContext): Record<string, string> {
  return {
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
        '@mantiq/auth': '^0.0.1',
        '@mantiq/cli': '^0.0.1',
        '@mantiq/core': '^0.0.1',
        '@mantiq/database': '^0.0.1',
        '@mantiq/validation': '^0.0.1',
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
`,

    '.env.example': `APP_NAME=${ctx.name}
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000
APP_PORT=3000
APP_KEY=

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite
`,

    '.gitignore': `node_modules/
dist/
*.sqlite
*.sqlite-journal
.env
.DS_Store
tsconfig.tsbuildinfo
`,

    // ── Entry points ────────────────────────────────────────────────────────

    'index.ts': `import { Application, CoreServiceProvider, HttpKernel, RouterImpl, CorsMiddleware, StartSession, EncryptCookies, VerifyCsrfToken } from '@mantiq/core'
import { AuthServiceProvider, Authenticate, RedirectIfAuthenticated } from '@mantiq/auth'
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

await app.registerProviders([CoreServiceProvider, DatabaseServiceProvider, AuthServiceProvider])
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

// Global middleware
kernel.setGlobalMiddleware(['cors', 'encrypt.cookies', 'session'])

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
  MigrateCommand,
  MigrateRollbackCommand,
  MigrateResetCommand,
  MigrateFreshCommand,
  MigrateStatusCommand,
  SeedCommand,
  MakeControllerCommand,
  MakeModelCommand,
  MakeMigrationCommand,
  MakeSeederCommand,
  MakeFactoryCommand,
  MakeMiddlewareCommand,
  MakeRequestCommand,
  ServeCommand,
  RouteListCommand,
  TinkerCommand,
} from '@mantiq/cli'

const kernel = new Kernel()

kernel.registerAll([
  new MigrateCommand(),
  new MigrateRollbackCommand(),
  new MigrateResetCommand(),
  new MigrateFreshCommand(),
  new MigrateStatusCommand(),
  new SeedCommand(),
  new MakeControllerCommand(),
  new MakeModelCommand(),
  new MakeMigrationCommand(),
  new MakeSeederCommand(),
  new MakeFactoryCommand(),
  new MakeMiddlewareCommand(),
  new MakeRequestCommand(),
  new ServeCommand(),
  new RouteListCommand(),
  new TinkerCommand(),
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
  static override fillable = ['name', 'email', 'role', 'password']
  static override guarded = ['id']
  static override hidden = ['password', 'remember_token', 'created_at', 'updated_at']
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
      t.string('role', 20).default('user')
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
}
