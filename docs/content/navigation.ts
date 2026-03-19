export interface NavSection {
  title: string
  pages: NavPage[]
}

export interface NavPage {
  slug: string
  title: string
}

export const navigation: NavSection[] = [
  {
    title: 'Prologue',
    pages: [
      { slug: 'introduction', title: 'Introduction' },
      { slug: 'installation', title: 'Installation' },
      { slug: 'directory-structure', title: 'Directory Structure' },
      { slug: 'configuration', title: 'Configuration' },
    ],
  },
  {
    title: 'Architecture',
    pages: [
      { slug: 'request-lifecycle', title: 'Request Lifecycle' },
      { slug: 'service-container', title: 'Service Container' },
      { slug: 'service-providers', title: 'Service Providers' },
    ],
  },
  {
    title: 'The Basics',
    pages: [
      { slug: 'routing', title: 'Routing' },
      { slug: 'middleware', title: 'Middleware' },
      { slug: 'controllers', title: 'Controllers' },
      { slug: 'requests', title: 'Requests' },
      { slug: 'responses', title: 'Responses' },
      { slug: 'error-handling', title: 'Error Handling' },
    ],
  },
  {
    title: 'Frontend',
    pages: [
      { slug: 'vite', title: 'Vite Integration' },
      { slug: 'ssr', title: 'Server-Side Rendering' },
      { slug: 'starter-kits', title: 'Starter Kits' },
    ],
  },
  {
    title: 'Database',
    pages: [
      { slug: 'database', title: 'Getting Started' },
      { slug: 'query-builder', title: 'Query Builder' },
      { slug: 'migrations', title: 'Migrations' },
      { slug: 'seeding', title: 'Seeding' },
      { slug: 'models', title: 'Models' },
      { slug: 'relationships', title: 'Relationships' },
    ],
  },
  {
    title: 'Security',
    pages: [
      { slug: 'authentication', title: 'Authentication' },
      { slug: 'hashing', title: 'Hashing' },
      { slug: 'encryption', title: 'Encryption' },
    ],
  },
  {
    title: 'Validation',
    pages: [
      { slug: 'validation', title: 'Validation' },
      { slug: 'form-requests', title: 'Form Requests' },
    ],
  },
  {
    title: 'Digging Deeper',
    pages: [
      { slug: 'events', title: 'Events & Broadcasting' },
      { slug: 'filesystem', title: 'File Storage' },
      { slug: 'caching', title: 'Caching' },
      { slug: 'sessions', title: 'Sessions' },
      { slug: 'cli', title: 'CLI Commands' },
    ],
  },
]

// Flatten all pages for lookup
const allPages: { slug: string; title: string }[] = navigation.flatMap((s) => s.pages)

// Page content registry — lazy-loaded
const pageModules: Record<string, () => Promise<{ default: { title: string; content: string } }>> = {
  introduction: () => import('./pages/introduction.ts'),
  installation: () => import('./pages/installation.ts'),
  'directory-structure': () => import('./pages/directory-structure.ts'),
  configuration: () => import('./pages/configuration.ts'),
  'request-lifecycle': () => import('./pages/request-lifecycle.ts'),
  'service-container': () => import('./pages/service-container.ts'),
  'service-providers': () => import('./pages/service-providers.ts'),
  routing: () => import('./pages/routing.ts'),
  middleware: () => import('./pages/middleware.ts'),
  controllers: () => import('./pages/controllers.ts'),
  requests: () => import('./pages/requests.ts'),
  responses: () => import('./pages/responses.ts'),
  'error-handling': () => import('./pages/error-handling.ts'),
  vite: () => import('./pages/vite.ts'),
  ssr: () => import('./pages/ssr.ts'),
  'starter-kits': () => import('./pages/starter-kits.ts'),
  database: () => import('./pages/database.ts'),
  'query-builder': () => import('./pages/query-builder.ts'),
  migrations: () => import('./pages/migrations.ts'),
  seeding: () => import('./pages/seeding.ts'),
  models: () => import('./pages/models.ts'),
  relationships: () => import('./pages/relationships.ts'),
  authentication: () => import('./pages/authentication.ts'),
  hashing: () => import('./pages/hashing.ts'),
  encryption: () => import('./pages/encryption.ts'),
  validation: () => import('./pages/validation.ts'),
  'form-requests': () => import('./pages/form-requests.ts'),
  events: () => import('./pages/events.ts'),
  filesystem: () => import('./pages/filesystem.ts'),
  caching: () => import('./pages/caching.ts'),
  sessions: () => import('./pages/sessions.ts'),
  cli: () => import('./pages/cli.ts'),
}

// Cache loaded pages
const pageCache = new Map<string, { title: string; content: string }>()

export async function getPage(slug: string): Promise<{ title: string; content: string } | null> {
  if (pageCache.has(slug)) return pageCache.get(slug)!
  const loader = pageModules[slug]
  if (!loader) return null
  try {
    const mod = await loader()
    pageCache.set(slug, mod.default)
    return mod.default
  } catch {
    return null
  }
}

export function getAdjacentPages(slug: string): { prev: NavPage | null; next: NavPage | null } {
  const idx = allPages.findIndex((p) => p.slug === slug)
  return {
    prev: idx > 0 ? allPages[idx - 1]! : null,
    next: idx < allPages.length - 1 ? allPages[idx + 1]! : null,
  }
}
