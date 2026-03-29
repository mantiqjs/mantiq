export type Theme = 'default' | 'linear' | 'notion' | 'stripe' | 'modern-saas'

export interface TemplateContext {
  name: string
  appKey: string
  kit?: 'react' | 'vue' | 'svelte' | undefined
  ui: 'shadcn' | 'tailwind'
  theme: Theme
  auth: 'builtin' | 'none'
  optionalPackages: string[]
}

/**
 * Returns ONLY the files that need dynamic generation or kit-specific overrides.
 * The base skeleton is copied as-is from the skeleton/ directory.
 *
 * Dynamic files:
 *   - package.json (project name, deps vary by kit)
 *   - .env / .env.example (APP_KEY generated)
 *
 * Kit overrides (when a framework is selected):
 *   - package.json gets additional deps (react, vue, svelte, vite, tailwind, etc.)
 */
export function getTemplates(ctx: TemplateContext): Record<string, string> {
  const templates: Record<string, string> = {}

  // ── package.json (always dynamic — name + deps) ────────────────────────
  const baseDeps: Record<string, string> = {
    ...(ctx.auth !== 'none' ? { '@mantiq/auth': '^0.5.0' } : {}),
    '@mantiq/cli': '^0.5.0',
    '@mantiq/core': '^0.5.0',
    '@mantiq/database': '^0.5.0',
    '@mantiq/events': '^0.5.0',
    '@mantiq/filesystem': '^0.5.0',
    '@mantiq/heartbeat': '^0.5.0',
    '@mantiq/helpers': '^0.5.0',
    '@mantiq/logging': '^0.5.0',
    '@mantiq/queue': '^0.5.0',
    '@mantiq/realtime': '^0.5.0',
    '@mantiq/validation': '^0.5.0',
    '@mantiq/mail': '^0.5.0',
    '@mantiq/notify': '^0.5.0',
    '@mantiq/search': '^0.5.0',
    '@mantiq/health': '^0.5.0',
    ...(ctx.optionalPackages.includes('ai') ? { '@mantiq/ai': '^0.5.0' } : {}),
  }

  const baseDevDeps: Record<string, string> = {
    '@mantiq/testing': '^0.5.0',
    'bun-types': 'latest',
    'typescript': '^5.7.0',
  }

  const scripts: Record<string, string> = {
    dev: 'bun run --watch index.ts',
    start: 'bun run index.ts',
    mantiq: 'bun run mantiq.ts',
    test: 'bun test tests/',
  }

  if (ctx.kit) {
    // Kit-specific additions
    const frameworkDevDeps: Record<string, string> = ctx.kit === 'react'
      ? { 'react': '^19.0.0', 'react-dom': '^19.0.0', '@vitejs/plugin-react': '^6.0.0', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' }
      : ctx.kit === 'vue'
      ? { 'vue': '^3.5.0', '@vitejs/plugin-vue': '^6.0.0' }
      : { 'svelte': '^5.0.0', '@sveltejs/vite-plugin-svelte': '^7.0.0' }

    const shadcnOnly = ctx.ui === 'shadcn'

    const uiDeps: Record<string, string> = ctx.kit === 'react'
      ? {
          'clsx': '^2.1.0', 'tailwind-merge': '^2.6.0',
          ...(shadcnOnly ? { 'class-variance-authority': '^0.7.1', 'lucide-react': '^0.577.0', 'radix-ui': '^1.4.0' } : {}),
        }
      : ctx.kit === 'vue'
      ? {
          'clsx': '^2.1.0', 'tailwind-merge': '^3.5.0',
          ...(shadcnOnly ? { 'class-variance-authority': '^0.7.1', 'lucide-vue-next': '^0.577.0', 'reka-ui': '^2.9.0' } : {}),
          'tw-animate-css': '^1.4.0', '@tanstack/vue-table': '^8.0.0',
        }
      : {
          'clsx': '^2.1.0', 'tailwind-merge': '^2.6.0',
          ...(shadcnOnly ? { 'tailwind-variants': '^3.2.0', 'lucide-svelte': '^0.577.0', '@lucide/svelte': '^0.577.0', 'bits-ui': '^2.16.0' } : {}),
        }

    Object.assign(baseDeps, {
      '@mantiq/vite': '^0.5.0',
      ...uiDeps,
    })

    Object.assign(baseDevDeps, {
      'vite': '^8.0.0',
      'tailwindcss': '^4.0.0',
      '@tailwindcss/vite': '^4.0.0',
      ...frameworkDevDeps,
    })

    scripts.dev = 'bun run dev:backend & bun run dev:frontend & wait'
    scripts['dev:backend'] = 'bun run --watch index.ts'
    scripts['dev:frontend'] = 'bunx vite --clearScreen false'
    scripts.build = `vite build && vite build --ssr ${ctx.kit === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts'} --outDir bootstrap/ssr`
  }

  templates['package.json'] = JSON.stringify({
    name: ctx.name,
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts,
    dependencies: baseDeps,
    devDependencies: baseDevDeps,
  }, null, 2) + '\n'

  // ── .env (dynamic — APP_KEY generated) ─────────────────────────────────
  const envBody = (appKey: string) => `# Application
APP_NAME=${ctx.name}
APP_ENV=local
APP_DEBUG=true
APP_KEY=${appKey}
APP_URL=http://localhost:3000
APP_PORT=3000

# Database
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite
# DB_HOST=127.0.0.1
# DB_PORT=5432
# DB_USERNAME=postgres
# DB_PASSWORD=

# Session
SESSION_DRIVER=memory
SESSION_LIFETIME=120
SESSION_COOKIE=mantiq_session

# Cache
CACHE_STORE=memory
# REDIS_HOST=127.0.0.1
# REDIS_PORT=6379
# REDIS_PASSWORD=

# Queue
QUEUE_CONNECTION=sync

# Mail
MAIL_MAILER=log
MAIL_FROM_ADDRESS=hello@example.com
MAIL_FROM_NAME=\${APP_NAME}
# MAIL_HOST=localhost
# MAIL_PORT=587
# MAIL_USERNAME=
# MAIL_PASSWORD=

# Logging
LOG_CHANNEL=stack

# Hashing
HASH_DRIVER=bcrypt
BCRYPT_ROUNDS=10

# Broadcasting
BROADCAST_DRIVER=bun

# Filesystem
FILESYSTEM_DISK=local

# Search
# ALGOLIA_APP_ID=
# ALGOLIA_SECRET=
# MEILISEARCH_HOST=http://127.0.0.1:7700
# MEILISEARCH_KEY=
${ctx.kit ? '\n# Vite\nVITE_DEV_SERVER_URL=http://localhost:5173' : ''}
`

  templates['.env'] = envBody(ctx.appKey)
  templates['.env.example'] = envBody('')

  return templates
}
