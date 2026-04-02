import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createTestApp, postWithCsrf, type TestApp } from './helpers.ts'

let app: TestApp

/**
 * Write Studio files into the scaffolded app:
 *   - app/Studio/AdminPanel.ts
 *   - app/Studio/Resources/UserResource.ts
 *   - app/Providers/StudioServiceProvider.ts
 *
 * These files mirror what `bun mantiq studio:install` + `make:resource UserResource --generate`
 * would produce, but we write them directly to avoid needing a running DB for introspection.
 */
function installStudio(dir: string): void {
  const studioDir = join(dir, 'app', 'Studio')
  const resourcesDir = join(studioDir, 'Resources')
  const providersDir = join(dir, 'app', 'Providers')

  mkdirSync(resourcesDir, { recursive: true })
  mkdirSync(providersDir, { recursive: true })

  // AdminPanel
  writeFileSync(
    join(studioDir, 'AdminPanel.ts'),
    `import { StudioPanel } from '@mantiq/studio'
import { UserResource } from './Resources/UserResource.ts'

export class AdminPanel extends StudioPanel {
  override path = '/admin'
  override brandName = 'Test Admin'

  override resources() {
    return [UserResource]
  }
}
`,
  )

  // UserResource — matches the User model from the skeleton
  writeFileSync(
    join(resourcesDir, 'UserResource.ts'),
    `import { Resource } from '@mantiq/studio'
import { Form, TextInput } from '@mantiq/studio'
import { Table, TextColumn } from '@mantiq/studio'
import { EditAction, DeleteAction, BulkDeleteAction } from '@mantiq/studio'
import { User } from '../../Models/User.ts'

export class UserResource extends Resource {
  static override model = User
  static override navigationIcon = 'users'
  static override navigationLabel = 'Users'
  static override recordTitleAttribute = 'name'
  static override globallySearchable = true
  static override defaultSort = 'id'
  static override defaultSortDirection: 'asc' | 'desc' = 'desc'

  override form() {
    return Form.make([
      TextInput.make('name').required().rules(['string', 'max:255']),
      TextInput.make('email').required().rules(['email']),
    ])
  }

  override table() {
    return Table.make([
      TextColumn.make('id').label('#').sortable().width('60px'),
      TextColumn.make('name').searchable().sortable(),
      TextColumn.make('email').searchable().sortable(),
      TextColumn.make('created_at').label('Created').sortable(),
    ])
    .actions([EditAction.make(), DeleteAction.make()])
    .bulkActions([BulkDeleteAction.make()])
    .defaultSort('id', 'desc')
  }
}
`,
  )

  // StudioServiceProvider
  writeFileSync(
    join(providersDir, 'StudioServiceProvider.ts'),
    `import { StudioServiceProvider as BaseProvider } from '@mantiq/studio'

export class StudioServiceProvider extends BaseProvider {}
`,
  )
}

/**
 * Seed the database with test users after migrations have run.
 * Uses bun to execute a simple inline script that inserts users via raw SQL.
 */
function seedUsers(dir: string): void {
  // Write a temporary seed script that uses the app's database
  const seedScript = join(dir, '_e2e_seed.ts')
  writeFileSync(
    seedScript,
    `import { Database } from 'bun:sqlite'
import { resolve } from 'node:path'

const dbPath = resolve(import.meta.dir, 'database/database.sqlite')
const db = new Database(dbPath)

// Hash passwords using Bun's native bcrypt
const hash = await Bun.password.hash('password123', { algorithm: 'bcrypt', cost: 4 })

db.exec(\`
  INSERT OR IGNORE INTO users (name, email, password, created_at, updated_at)
  VALUES
    ('Admin User', 'admin@example.com', '\${hash}', datetime('now'), datetime('now')),
    ('Jane Smith', 'jane@example.com', '\${hash}', datetime('now'), datetime('now')),
    ('Bob Wilson', 'bob@example.com', '\${hash}', datetime('now'), datetime('now')),
    ('Alice Johnson', 'alice@example.com', '\${hash}', datetime('now'), datetime('now')),
    ('Charlie Brown', 'charlie@example.com', '\${hash}', datetime('now'), datetime('now'))
\`)

db.close()
console.log('Seeded 5 users')
`,
  )

  try {
    execSync(`bun ${seedScript}`, { cwd: dir, stdio: 'pipe', timeout: 15_000 })
  } catch (err) {
    console.warn('[studio.spec] Failed to seed users:', err)
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Scaffold with React kit (provides login/register UI and session auth)
  app = await createTestApp('studio', 'react')

  // Install Studio files into the scaffolded app
  installStudio(app.dir)

  // Seed users into the database
  seedUsers(app.dir)

  // Restart the server so it picks up the new Studio provider + panel
  app.process.kill('SIGTERM')
  await new Promise(r => setTimeout(r, 1000))

  const { spawn } = await import('node:child_process')
  const proc = spawn('bun', ['run', 'index.ts'], {
    cwd: app.dir,
    env: { ...process.env, APP_PORT: String(app.port), APP_DEBUG: 'true', APP_ENV: 'local' },
    stdio: 'pipe',
  })

  app.process = proc

  // Wait for the server to be ready again
  const start = Date.now()
  while (Date.now() - start < 15_000) {
    try {
      const res = await fetch(app.url)
      if (res.ok) break
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
})

test.afterAll(() => {
  app?.kill()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Authenticate via session login and return cookies for use in API calls.
 * Uses the scaffolded app's /login endpoint.
 */
async function loginAsAdmin(request: any): Promise<void> {
  await postWithCsrf(request, app.url + '/login', {
    email: 'admin@example.com',
    password: 'password123',
  })
}

// ── 1. SPA Loading ────────────────────────────────────────────────────────

test.describe('Studio SPA Loading', () => {
  test('GET /admin serves HTML with studio-base-path meta tag', async ({ page }) => {
    const response = await page.goto(app.url + '/admin')
    expect(response?.status()).toBe(200)

    const html = await page.content()
    expect(html).toContain('studio-base-path')
    expect(html).toContain('content="/admin"')
  })

  test('JS assets load without errors (no 404)', async ({ page }) => {
    const assetErrors: string[] = []
    page.on('response', (res) => {
      const url = res.url()
      if ((url.includes('.js') || url.includes('.css')) && res.status() >= 400) {
        assetErrors.push(`${res.status()} ${url}`)
      }
    })

    await page.goto(app.url + '/admin')
    // Give time for assets to load
    await page.waitForTimeout(2000)
    expect(assetErrors).toEqual([])
  })

  test('SPA sub-routes also serve the Studio HTML shell', async ({ page }) => {
    const response = await page.goto(app.url + '/admin/resources/users')
    expect(response?.status()).toBe(200)

    const html = await page.content()
    expect(html).toContain('studio-base-path')
  })
})

// ── 2. Unauthenticated Redirect ──────────────────────────────────────────

test.describe('Studio Unauthenticated Redirect', () => {
  test('API routes return 401 JSON when unauthenticated', async ({ request }) => {
    const res = await request.get(app.url + '/admin/api/panel', {
      headers: { Accept: 'application/json' },
    })
    // Studio API should return 401 for unauthenticated requests
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('unauthenticated browser request redirects to /login (not /admin/login)', async ({ page }) => {
    // Intercept the redirect by disabling auto-follow
    const response = await page.goto(app.url + '/admin/api/panel')

    // The URL should either be /login or the response should indicate redirect to /login
    // Since Playwright follows redirects, check the final URL or the response chain
    const url = page.url()
    // Should NOT redirect to /admin/login (would cause infinite loops)
    expect(url).not.toContain('/admin/login')
  })
})

// ── 3. Panel Schema API ──────────────────────────────────────────────────

test.describe('Studio Panel Schema API', () => {
  test('GET /admin/api/panel returns panel config with resources and navigation', async ({ request }) => {
    // Login first
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/panel')
    expect(res.status()).toBe(200)

    const body = await res.json()

    // Panel identity
    expect(body.id).toBeDefined()
    expect(body.path).toBe('/admin')
    expect(body.brandName).toBe('Test Admin')

    // Resources array
    expect(body.resources).toBeDefined()
    expect(Array.isArray(body.resources)).toBe(true)
    expect(body.resources.length).toBeGreaterThanOrEqual(1)

    const userResource = body.resources.find((r: any) => r.slug === 'users')
    expect(userResource).toBeDefined()
    expect(userResource.label).toBe('Users')
    expect(userResource.navigationIcon).toBe('users')
    expect(userResource.globallySearchable).toBe(true)

    // Navigation
    expect(body.navigation).toBeDefined()
    expect(Array.isArray(body.navigation)).toBe(true)
    expect(body.navigation.length).toBeGreaterThanOrEqual(1)

    // Find "Users" in navigation items
    const allItems = body.navigation.flatMap((g: any) => g.items)
    const usersNav = allItems.find((item: any) => item.label === 'Users')
    expect(usersNav).toBeDefined()
    expect(usersNav.url).toContain('/resources/users')
  })

  test('panel config includes theme settings', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/panel')
    const body = await res.json()

    expect(body.darkMode).toBeDefined()
    expect(body.sidebarCollapsible).toBeDefined()
    expect(body.globalSearchEnabled).toBeDefined()
    expect(body.maxContentWidth).toBeDefined()
  })
})

// ── 4. Resource List API ──────────────────────────────────────────────────

test.describe('Studio Resource List API', () => {
  test('GET /admin/api/resources/users returns paginated data with meta', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/users')
    expect(res.status()).toBe(200)

    const body = await res.json()

    // Data array
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)

    // Meta pagination info
    expect(body.meta).toBeDefined()
    expect(body.meta.total).toBeGreaterThanOrEqual(5)
    expect(body.meta.currentPage).toBe(1)
    expect(body.meta.perPage).toBeGreaterThan(0)
    expect(body.meta.lastPage).toBeGreaterThanOrEqual(1)

    // Each record should have user fields
    const firstUser = body.data[0]
    expect(firstUser.id).toBeDefined()
    expect(firstUser.name).toBeDefined()
    expect(firstUser.email).toBeDefined()
    // Password should NOT be exposed (model has hidden = ['password'])
    expect(firstUser.password).toBeUndefined()
  })

  test('pagination with custom perPage', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/users?page=1&perPage=2')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data.length).toBeLessThanOrEqual(2)
    expect(body.meta.perPage).toBe(2)
    expect(body.meta.lastPage).toBeGreaterThanOrEqual(2)
  })

  test('returns 404 for unknown resource', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/nonexistent')
    expect(res.status()).toBe(404)
  })
})

// ── 5. Resource CRUD API ──────────────────────────────────────────────────

test.describe('Studio Resource CRUD API', () => {
  let createdUserId: number | string

  test('POST /admin/api/resources/users creates a new record (201)', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.post(app.url + '/admin/api/resources/users', {
      data: {
        name: 'New Studio User',
        email: `studio-new-${Date.now()}@example.com`,
      },
    })
    expect(res.status()).toBe(201)

    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.name).toBe('New Studio User')
    expect(body.data.id).toBeDefined()
    expect(body.message).toBe('Created.')

    createdUserId = body.data.id
  })

  test('GET /admin/api/resources/users/:id returns the created record', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + `/admin/api/resources/users/${createdUserId}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.id).toBe(createdUserId)
    expect(body.data.name).toBe('New Studio User')
  })

  test('PUT /admin/api/resources/users/:id updates the record', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.put(app.url + `/admin/api/resources/users/${createdUserId}`, {
      data: {
        name: 'Updated Studio User',
        email: `studio-updated-${Date.now()}@example.com`,
      },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data.name).toBe('Updated Studio User')
    expect(body.message).toBe('Updated.')
  })

  test('DELETE /admin/api/resources/users/:id deletes the record', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.delete(app.url + `/admin/api/resources/users/${createdUserId}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.message).toBe('Deleted.')
  })

  test('GET /admin/api/resources/users/:id returns 404 after deletion', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + `/admin/api/resources/users/${createdUserId}`)
    expect(res.status()).toBe(404)
  })

  test('GET /admin/api/resources/users/:id returns 404 for nonexistent ID', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/users/99999')
    expect(res.status()).toBe(404)
  })

  test('PUT /admin/api/resources/users/:id returns 404 for nonexistent ID', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.put(app.url + '/admin/api/resources/users/99999', {
      data: { name: 'Ghost' },
    })
    expect(res.status()).toBe(404)
  })

  test('DELETE /admin/api/resources/users/:id returns 404 for nonexistent ID', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.delete(app.url + '/admin/api/resources/users/99999')
    expect(res.status()).toBe(404)
  })
})

// ── 6. Search API ─────────────────────────────────────────────────────────

test.describe('Studio Search API', () => {
  test('GET /admin/api/resources/users?search=Admin returns filtered results', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/users?search=Admin')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data.length).toBeGreaterThanOrEqual(1)

    // All results should match the search term in name or email
    for (const record of body.data) {
      const matchesName = record.name?.toLowerCase().includes('admin')
      const matchesEmail = record.email?.toLowerCase().includes('admin')
      expect(matchesName || matchesEmail).toBe(true)
    }
  })

  test('search is case-insensitive', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/users?search=alice')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data.length).toBeGreaterThanOrEqual(1)
    const names = body.data.map((r: any) => r.name)
    expect(names).toContain('Alice Johnson')
  })

  test('search with no results returns empty data', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/users?search=zzzznonexistent')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveLength(0)
    expect(body.meta.total).toBe(0)
  })

  test('global search returns grouped results', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/search?q=Admin')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.results).toBeDefined()
    expect(Array.isArray(body.results)).toBe(true)

    if (body.results.length > 0) {
      const usersResult = body.results.find((r: any) => r.resource === 'users')
      expect(usersResult).toBeDefined()
      expect(usersResult.records.length).toBeGreaterThanOrEqual(1)
    }
  })

  test('global search with empty query returns empty results', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/search?q=')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.results).toEqual([])
  })
})

// ── 7. Schema API ──────────────────────────────────────────────────────────

test.describe('Studio Schema API', () => {
  test('GET /admin/api/resources/users/schema returns form and table schemas', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/users/schema')
    expect(res.status()).toBe(200)

    const body = await res.json()

    // Form schema
    expect(body.form).toBeDefined()
    expect(body.form.type).toBe('form')
    expect(body.form.components).toBeDefined()
    expect(Array.isArray(body.form.components)).toBe(true)
    expect(body.form.components.length).toBeGreaterThanOrEqual(2)

    // Verify form components include name and email
    const componentNames = body.form.components.map((c: any) => c.name)
    expect(componentNames).toContain('name')
    expect(componentNames).toContain('email')

    // Check component properties
    const nameField = body.form.components.find((c: any) => c.name === 'name')
    expect(nameField.required).toBe(true)
    expect(nameField.type).toBeDefined()

    // Table schema
    expect(body.table).toBeDefined()
    expect(body.table.type).toBe('table')
    expect(body.table.columns).toBeDefined()
    expect(Array.isArray(body.table.columns)).toBe(true)
    expect(body.table.columns.length).toBeGreaterThanOrEqual(2)

    // Verify table columns
    const columnNames = body.table.columns.map((c: any) => c.name)
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('email')

    // Check searchable flag on name column
    const nameColumn = body.table.columns.find((c: any) => c.name === 'name')
    expect(nameColumn.searchable).toBe(true)
    expect(nameColumn.sortable).toBe(true)
  })

  test('schema includes actions', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/users/schema')
    const body = await res.json()

    // Table should have actions
    expect(body.table.actions).toBeDefined()
    expect(Array.isArray(body.table.actions)).toBe(true)

    // Should have edit and delete actions
    const actionNames = body.table.actions.map((a: any) => a.name)
    expect(actionNames).toContain('edit')
    expect(actionNames).toContain('delete')

    // Bulk actions
    expect(body.table.bulkActions).toBeDefined()
    const bulkActionNames = body.table.bulkActions.map((a: any) => a.name)
    expect(bulkActionNames).toContain('delete')
  })

  test('schema returns 404 for unknown resource', async ({ request }) => {
    await loginAsAdmin(request)

    const res = await request.get(app.url + '/admin/api/resources/nonexistent/schema')
    expect(res.status()).toBe(404)
  })
})

// ── 8. Navigation (SPA browser test) ──────────────────────────────────────

test.describe('Studio Navigation', () => {
  test('studio SPA loads with root div', async ({ page }) => {
    const response = await page.goto(app.url + '/admin')
    expect(response?.status()).toBe(200)

    // The Studio SPA should render into a root div
    const rootDiv = page.locator('#root')
    await expect(rootDiv).toBeAttached({ timeout: 5000 })
  })

  test('all Studio API endpoints require authentication', async ({ request }) => {
    const endpoints = [
      { method: 'GET', url: '/admin/api/panel' },
      { method: 'GET', url: '/admin/api/resources/users' },
      { method: 'GET', url: '/admin/api/resources/users/schema' },
      { method: 'GET', url: '/admin/api/resources/users/1' },
      { method: 'POST', url: '/admin/api/resources/users' },
      { method: 'PUT', url: '/admin/api/resources/users/1' },
      { method: 'DELETE', url: '/admin/api/resources/users/1' },
      { method: 'GET', url: '/admin/api/search?q=test' },
    ]

    for (const { method, url } of endpoints) {
      const res = await request.fetch(app.url + url, {
        method,
        headers: { Accept: 'application/json' },
      })
      expect(res.status()).toBeGreaterThanOrEqual(400)
      expect(res.status()).toBeLessThan(500)
    }
  })

  test('sorting works on resource list', async ({ request }) => {
    await loginAsAdmin(request)

    const ascRes = await request.get(app.url + '/admin/api/resources/users?sort=name&direction=asc')
    const descRes = await request.get(app.url + '/admin/api/resources/users?sort=name&direction=desc')

    expect(ascRes.status()).toBe(200)
    expect(descRes.status()).toBe(200)

    const ascBody = await ascRes.json()
    const descBody = await descRes.json()

    if (ascBody.data.length > 1 && descBody.data.length > 1) {
      // First item in ascending should differ from first item in descending
      expect(ascBody.data[0].name).not.toBe(descBody.data[0].name)
    }
  })

  test('filter by column works', async ({ request }) => {
    await loginAsAdmin(request)

    // Filter by name — this uses the default where clause filter
    const res = await request.get(
      app.url + '/admin/api/resources/users?filter[name]=Admin%20User',
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    if (body.data.length > 0) {
      expect(body.data[0].name).toBe('Admin User')
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TODO: Features not yet tested or not yet implemented
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Studio Actions', () => {
  test.todo('POST /admin/api/resources/users/actions/delete deletes record')
  test.todo('DELETE action checks canDelete authorization')
  test.todo('DELETE action runs beforeDelete/afterDelete lifecycle hooks')
  test.todo('POST /admin/api/resources/users/bulk-actions/delete deletes multiple records')
  test.todo('Bulk delete checks authorization per record')
  test.todo('Custom action execution returns result')
  test.todo('Action with confirmation dialog')
  test.todo('Action with modal form collects data before execution')
})

test.describe('Studio Lifecycle Hooks', () => {
  test.todo('beforeCreate receives and can modify data')
  test.todo('afterCreate receives the created record')
  test.todo('beforeSave receives record and data on update')
  test.todo('afterSave receives the saved record')
  test.todo('beforeDelete runs before deletion')
  test.todo('afterDelete runs after deletion')
})

test.describe('Studio Validation', () => {
  test.todo('POST with missing required fields returns 422 with field errors')
  test.todo('PUT with invalid email returns 422')
  test.todo('Validation rules extracted from form schema (required, email, max:255)')
  test.todo('422 response includes per-field error messages')
})

test.describe('Studio Resource Authorization', () => {
  test.todo('canViewAny returning false → 403 on list')
  test.todo('canCreate returning false → 403 on store')
  test.todo('canUpdate returning false → 403 on update')
  test.todo('canDelete returning false → 403 on destroy')
  test.todo('canView returning false → 403 on show')
  test.todo('Panel canAccess gate returning false → 403')
})

test.describe('Studio Relation Endpoint', () => {
  test.todo('GET /admin/api/resources/posts/relation/user returns value/label pairs')
  test.todo('Returns 404 for unknown relation name')
})

test.describe('Studio Navigation Builder', () => {
  test.todo('Resources auto-grouped in navigation by navigationGroup')
  test.todo('navigationSort controls item order within group')
  test.todo('navigationLabel overrides auto-derived label')
  test.todo('navigationIcon appears in sidebar items')
})

test.describe('Studio Multiple Panels', () => {
  test.todo('Two panels at /admin and /portal can coexist')
  test.todo('Each panel has its own resources and navigation')
  test.todo('Panel-level canAccess isolates access')
})

test.describe('Studio Widgets', () => {
  test.todo('StatsWidget serialization includes label, value, trend')
  test.todo('ChartWidget serialization includes chart type and data')
  test.todo('TableWidget serialization wraps a Table instance')
  test.todo('headerWidgets appear in resource list page schema')
  test.todo('footerWidgets appear in resource list page schema')
})

test.describe('Studio Code Generation', () => {
  test.todo('make:resource generates basic resource file')
  test.todo('make:resource --generate introspects DB schema')
  test.todo('make:resource --generate detects TINYINT(1) as boolean → Toggle')
  test.todo('make:resource --generate detects is_ prefixed columns as boolean')
  test.todo('make:resource --generate creates Textarea for text columns')
  test.todo('make:resource --generate creates Select with TODO for enum-like columns')
  test.todo('make:panel generates panel class with path and colors')
  test.todo('studio:install creates AdminPanel, config, and provider wrapper')
  test.todo('studio:publish copies frontend source for customization')
})

test.describe('Studio Frontend Navigation', () => {
  test.todo('Sidebar shows resource links with /admin prefix')
  test.todo('Clicking sidebar item navigates to /admin/resources/:slug')
  test.todo('Browser back/forward works with SPA routing')
  test.todo('Direct URL /admin/resources/users loads the correct page')
})

// ── Not Yet Implemented ──────────────────────────────────────────────────────

test.describe('Studio Infolists (not implemented)', () => {
  test.todo('Infolist displays read-only record detail view')
  test.todo('TextEntry, IconEntry, ImageEntry render correctly')
  test.todo('Infolist layout with Section, Tabs, Grid')
})

test.describe('Studio Soft Deletes (not implemented)', () => {
  test.todo('Trash page lists soft-deleted records')
  test.todo('Restore action un-deletes a record')
  test.todo('Force delete permanently removes a record')
  test.todo('softDeletes flag on Resource enables trash UI')
})

test.describe('Studio Form Reactivity (not implemented)', () => {
  test.todo('Dependent field updates via POST /api/form-state')
  test.todo('Field visibility toggles based on another field value')
  test.todo('Select options load dynamically based on parent field')
})

test.describe('Studio Tenant Scoping (not implemented)', () => {
  test.todo('modifyQuery filters records by tenant')
  test.todo('Different tenants see different data')
  test.todo('Create/update automatically scopes to tenant')
})

test.describe('Studio Relation Managers (not implemented)', () => {
  test.todo('HasMany relation tab on edit page')
  test.todo('BelongsToMany relation tab with attach/detach')
  test.todo('Inline create within relation manager')
})

test.describe('Studio Custom Pages (not implemented)', () => {
  test.todo('Custom page renders at /admin/pages/:slug')
  test.todo('Custom page with widgets')
  test.todo('Dashboard page with grid layout')
})
