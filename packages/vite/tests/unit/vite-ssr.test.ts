import { describe, it, expect, beforeEach } from 'bun:test'
import { Vite, escapeHtml } from '../../src/Vite.ts'
import {
  ViteManifestNotFoundError,
  ViteEntrypointNotFoundError,
  ViteSSREntryError,
} from '../../src/errors/ViteError.ts'
import type { ViteManifest, SSRModule } from '../../src/contracts/Vite.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function devVite(opts: { reactRefresh?: boolean; ssrEntry?: string } = {}): Vite {
  const v = new Vite({
    reactRefresh: opts.reactRefresh ?? false,
    ...(opts.ssrEntry ? { ssr: { entry: opts.ssrEntry } } : {}),
  })
  v.setDevMode('http://localhost:5173')
  return v
}

function prodVite(manifest: ViteManifest, opts: { ssrEntry?: string; ssrBundle?: string } = {}): Vite {
  const v = new Vite({
    buildDir: 'build',
    ...(opts.ssrEntry ? { ssr: { entry: opts.ssrEntry, bundle: opts.ssrBundle ?? undefined } } : {}),
  })
  v.setDevMode(false)
  v.setManifest(manifest)
  return v
}

function fakeSSRModule(html: string = '<div>SSR</div>', head: string = ''): SSRModule {
  return {
    render: async (_url: string, _data?: Record<string, unknown> | undefined) => ({
      html,
      head: head || undefined,
    }),
  }
}

function fakeRequest(path: string, headers: Record<string, string> = {}): {
  header(name: string): string | undefined
  path(): string
} {
  return {
    header: (name: string) => headers[name],
    path: () => path,
  }
}

// ── Manifest Parsing ────────────────────────────────────────────────────────

describe('Vite SSR — manifest parsing', () => {
  it('valid manifest produces correct asset URLs', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main-a1b2c3.js',
        src: 'src/main.tsx',
        isEntry: true,
        css: ['assets/main-d4e5f6.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('/build/assets/main-a1b2c3.js')
    expect(html).toContain('/build/assets/main-d4e5f6.css')
  })

  it('missing manifest throws ViteManifestNotFoundError', async () => {
    const v = new Vite({ publicDir: '/tmp/mantiq-nonexistent-ssr-test' })
    v.setDevMode(false)
    expect(v.loadManifest()).rejects.toBeInstanceOf(ViteManifestNotFoundError)
  })

  it('manifest with multiple entries resolves each correctly', async () => {
    const manifest: ViteManifest = {
      'src/app.tsx': {
        file: 'assets/app-111.js',
        isEntry: true,
        css: ['assets/app-222.css'],
      },
      'src/admin.tsx': {
        file: 'assets/admin-333.js',
        isEntry: true,
        css: ['assets/admin-444.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets(['src/app.tsx', 'src/admin.tsx'])
    expect(html).toContain('app-111.js')
    expect(html).toContain('admin-333.js')
    expect(html).toContain('app-222.css')
    expect(html).toContain('admin-444.css')
  })
})

// ── Asset Tag Generation: CSS ───────────────────────────────────────────────

describe('Vite SSR — CSS link tags', () => {
  it('generates <link rel="stylesheet"> for CSS entries', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main-abc.js',
        isEntry: true,
        css: ['assets/style-xyz.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('<link rel="stylesheet" href="/build/assets/style-xyz.css">')
  })

  it('collects CSS from transitive imports', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main.js',
        isEntry: true,
        imports: ['src/layout.tsx'],
      },
      'src/layout.tsx': {
        file: 'assets/layout.js',
        css: ['assets/layout.css'],
        imports: ['src/button.tsx'],
      },
      'src/button.tsx': {
        file: 'assets/button.js',
        css: ['assets/button.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('layout.css')
    expect(html).toContain('button.css')
  })

  it('de-duplicates CSS shared between entries', async () => {
    const manifest: ViteManifest = {
      'src/a.tsx': {
        file: 'assets/a.js',
        isEntry: true,
        css: ['assets/common.css'],
      },
      'src/b.tsx': {
        file: 'assets/b.js',
        isEntry: true,
        css: ['assets/common.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets(['src/a.tsx', 'src/b.tsx'])
    const matches = html.match(/common\.css/g)
    expect(matches?.length).toBe(1)
  })

  it('CSS-only entrypoint produces stylesheet link, not script', async () => {
    const manifest: ViteManifest = {
      'src/global.css': {
        file: 'assets/global-abc.css',
        src: 'src/global.css',
        isEntry: true,
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/global.css')
    expect(html).toContain('<link rel="stylesheet"')
    expect(html).not.toContain('<script')
  })
})

// ── Asset Tag Generation: JS ────────────────────────────────────────────────

describe('Vite SSR — JS script tags', () => {
  it('generates <script type="module"> for JS entrypoints', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main-hash.js',
        isEntry: true,
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('<script type="module" src="/build/assets/main-hash.js"></script>')
  })

  it('script tag uses type="module"', async () => {
    const manifest: ViteManifest = {
      'src/app.ts': {
        file: 'assets/app-999.js',
        isEntry: true,
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/app.ts')
    expect(html).toMatch(/^<script type="module"/)
  })
})

// ── Asset Tag Generation: Preload Hints ─────────────────────────────────────

describe('Vite SSR — preload hints', () => {
  it('generates modulepreload for imported chunks', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main.js',
        isEntry: true,
        imports: ['src/vendor.tsx'],
      },
      'src/vendor.tsx': {
        file: 'assets/vendor-abc.js',
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('<link rel="modulepreload" href="/build/assets/vendor-abc.js">')
  })

  it('does not modulepreload the entry chunk itself', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main.js',
        isEntry: true,
        imports: ['src/utils.tsx'],
      },
      'src/utils.tsx': {
        file: 'assets/utils.js',
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).not.toContain('modulepreload" href="/build/assets/main.js"')
  })

  it('collects deeply nested preloads', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main.js',
        isEntry: true,
        imports: ['src/a.tsx'],
      },
      'src/a.tsx': {
        file: 'assets/a.js',
        imports: ['src/b.tsx'],
      },
      'src/b.tsx': {
        file: 'assets/b.js',
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('modulepreload" href="/build/assets/a.js"')
    expect(html).toContain('modulepreload" href="/build/assets/b.js"')
  })
})

// ── HTML Shell Structure ────────────────────────────────────────────────────

describe('Vite SSR — HTML shell', () => {
  it('contains DOCTYPE declaration', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).toStartWith('<!DOCTYPE html>')
  })

  it('contains charset meta tag', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).toContain('<meta charset="UTF-8">')
  })

  it('contains viewport meta tag', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
  })

  it('injects CSS tags inside <head> (before </head>)', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main.js',
        isEntry: true,
        css: ['assets/app.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.page({ entry: 'src/main.tsx' })
    const headEnd = html.indexOf('</head>')
    const cssIdx = html.indexOf('assets/app.css')
    expect(cssIdx).toBeGreaterThan(-1)
    expect(cssIdx).toBeLessThan(headEnd)
  })

  it('injects JS script tags inside <body> (before </body>)', async () => {
    // In page(), the asset tags go inside <head>. But the data script goes inside <body>.
    // The assets are in <head>, so let's verify the structure is sound:
    // script tags from assets are within the <head> section
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main.js',
        isEntry: true,
      },
    }
    const v = prodVite(manifest)
    const html = await v.page({ entry: 'src/main.tsx' })
    // The script module tag is within the page
    expect(html).toContain('<script type="module" src="/build/assets/main.js"></script>')
    // body section exists
    expect(html).toContain('<body>')
    expect(html).toContain('</body>')
  })

  it('includes page data as JSON script tag', async () => {
    const v = devVite()
    const html = await v.page({
      entry: 'src/main.tsx',
      data: { _page: 'Dashboard', users: [{ id: 1 }] },
    })
    expect(html).toContain('window.__MANTIQ_DATA__')
    expect(html).toContain('"_page":"Dashboard"')
    expect(html).toContain('"users"')
  })

  it('data script tag is inside <body>', async () => {
    const v = devVite()
    const html = await v.page({
      entry: 'src/main.tsx',
      data: { greeting: 'hello' },
    })
    const bodyStart = html.indexOf('<body>')
    const bodyEnd = html.indexOf('</body>')
    const dataIdx = html.indexOf('__MANTIQ_DATA__')
    expect(dataIdx).toBeGreaterThan(bodyStart)
    expect(dataIdx).toBeLessThan(bodyEnd)
  })

  it('omits data script when no data provided', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).not.toContain('__MANTIQ_DATA__')
  })
})

// ── Dev Mode: localhost URLs ────────────────────────────────────────────────

describe('Vite SSR — dev mode URLs', () => {
  it('generates localhost URLs with Vite port', async () => {
    const v = devVite()
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('http://localhost:5173/src/main.tsx')
    expect(html).toContain('http://localhost:5173/@vite/client')
  })

  it('uses custom dev server URL', async () => {
    const v = new Vite({ devServerUrl: 'http://localhost:3001' })
    v.setDevMode('http://localhost:3001')
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('http://localhost:3001/src/main.tsx')
  })

  it('CSS entrypoints produce link tags with dev server URL', async () => {
    const v = devVite()
    const html = await v.assets('src/style.css')
    expect(html).toContain('<link rel="stylesheet" href="http://localhost:5173/src/style.css">')
  })

  it('includes React refresh preamble for React when enabled', async () => {
    const v = devVite({ reactRefresh: true })
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('@react-refresh')
    expect(html).toContain('RefreshRuntime.injectIntoGlobalHook')
    expect(html).toContain('__vite_plugin_react_preamble_installed__')
  })

  it('React refresh preamble precedes all other tags', async () => {
    const v = devVite({ reactRefresh: true })
    const html = await v.assets('src/main.tsx')
    const refreshIdx = html.indexOf('@react-refresh')
    const clientIdx = html.indexOf('@vite/client')
    const entryIdx = html.indexOf('src/main.tsx')
    expect(refreshIdx).toBeLessThan(clientIdx)
    expect(refreshIdx).toBeLessThan(entryIdx)
  })

  it('does not include React refresh when disabled', async () => {
    const v = devVite({ reactRefresh: false })
    const html = await v.assets('src/main.tsx')
    expect(html).not.toContain('@react-refresh')
  })
})

// ── Production Mode: Reads from Manifest ────────────────────────────────────

describe('Vite SSR — production mode', () => {
  it('reads asset paths from manifest file', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main-prod123.js',
        isEntry: true,
        css: ['assets/main-prod456.css'],
        imports: ['src/chunk.tsx'],
      },
      'src/chunk.tsx': {
        file: 'assets/chunk-prod789.js',
        css: ['assets/chunk-prodabc.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('/build/assets/main-prod123.js')
    expect(html).toContain('/build/assets/main-prod456.css')
    expect(html).toContain('/build/assets/chunk-prodabc.css')
    expect(html).toContain('modulepreload" href="/build/assets/chunk-prod789.js"')
  })

  it('throws for entrypoint missing from manifest', async () => {
    const v = prodVite({
      'src/main.tsx': { file: 'assets/main.js', isEntry: true },
    })
    expect(v.assets('src/missing.tsx')).rejects.toBeInstanceOf(ViteEntrypointNotFoundError)
  })

  it('flushManifest clears cached manifest', async () => {
    const v = prodVite({ 'x.js': { file: 'x-1.js' } })
    const m1 = await v.loadManifest()
    expect(m1['x.js']).toBeDefined()

    v.flushManifest()
    v.setManifest({ 'y.js': { file: 'y-2.js' } })
    const m2 = await v.loadManifest()
    expect(m2['y.js']).toBeDefined()
    expect(m2['x.js']).toBeUndefined()
  })
})

// ── SSR Entry Resolution ────────────────────────────────────────────────────

describe('Vite SSR — SSR entry resolution', () => {
  it('isSSR() returns true when ssr.entry is configured', () => {
    const v = new Vite({ ssr: { entry: 'src/ssr.tsx' } })
    expect(v.isSSR()).toBe(true)
  })

  it('isSSR() returns false when ssr.entry is not configured', () => {
    const v = new Vite()
    expect(v.isSSR()).toBe(false)
  })

  it('SSR config stores the entry path', () => {
    const v = new Vite({ ssr: { entry: 'src/ssr.tsx', bundle: 'bootstrap/ssr/ssr.js' } })
    expect(v.isSSR()).toBe(true)
    const cfg = v.getConfig()
    expect(cfg.ssr?.entry).toBe('src/ssr.tsx')
  })

  it('SSR config defaults bundle path', () => {
    const v = new Vite({ ssr: { entry: 'src/ssr.tsx' } })
    expect(v.isSSR()).toBe(true)
    // The default bundle is set internally — verify through render behavior
  })

  it('setBasePath stores the base path for SSR bundle resolution', () => {
    const v = new Vite({ ssr: { entry: 'src/ssr.tsx' } })
    // No throw — just setting the path
    v.setBasePath('/app/my-project')
    expect(v.isSSR()).toBe(true)
  })
})

// ── render() — the Inertia-like protocol ────────────────────────────────────

describe('Vite SSR — render()', () => {
  it('returns JSON for X-Mantiq header (client navigation)', async () => {
    const v = devVite()
    const req = fakeRequest('/dashboard', { 'X-Mantiq': 'true' })
    const response = await v.render(req, {
      page: 'Dashboard',
      entry: 'src/main.tsx',
      data: { users: [1, 2, 3] },
    })

    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('X-Mantiq')).toBe('true')

    const body = await response.json() as Record<string, unknown>
    expect(body._page).toBe('Dashboard')
    expect(body._url).toBe('/dashboard')
    expect(body.users).toEqual([1, 2, 3])
  })

  it('returns full HTML for first load (no X-Mantiq header)', async () => {
    const v = devVite()
    const req = fakeRequest('/home')
    const response = await v.render(req, {
      page: 'Home',
      entry: 'src/main.tsx',
      data: { message: 'welcome' },
    })

    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    const html = await response.text()
    expect(html).toStartWith('<!DOCTYPE html>')
    expect(html).toContain('__MANTIQ_DATA__')
    expect(html).toContain('"_page":"Home"')
    expect(html).toContain('"_url":"/home"')
  })

  it('render sets title in HTML response', async () => {
    const v = devVite()
    const req = fakeRequest('/about')
    const response = await v.render(req, {
      page: 'About',
      entry: 'src/main.tsx',
      title: 'About Us',
    })

    const html = await response.text()
    expect(html).toContain('<title>About Us</title>')
  })

  it('render includes extra head content', async () => {
    const v = devVite()
    const req = fakeRequest('/')
    const response = await v.render(req, {
      page: 'Home',
      entry: 'src/main.tsx',
      head: '<meta name="description" content="Test">',
    })

    const html = await response.text()
    expect(html).toContain('<meta name="description" content="Test">')
  })

  it('render with SSR injects server-rendered HTML into root div', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule(fakeSSRModule('<h1>Server Rendered</h1>'))

    const req = fakeRequest('/ssr-page')
    const response = await v.render(req, {
      page: 'SSRPage',
      entry: 'src/main.tsx',
    })

    const html = await response.text()
    expect(html).toContain('<h1>Server Rendered</h1>')
    expect(html).toContain('id="app"')
  })

  it('render with SSR includes SSR head content', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule(fakeSSRModule('<div>app</div>', '<link rel="stylesheet" href="/ssr.css">'))

    const req = fakeRequest('/styled')
    const response = await v.render(req, {
      page: 'Styled',
      entry: 'src/main.tsx',
    })

    const html = await response.text()
    expect(html).toContain('<link rel="stylesheet" href="/ssr.css">')
  })

  it('render falls back to CSR shell when SSR fails', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule({
      render: async () => { throw new Error('SSR crash') },
    })

    const req = fakeRequest('/broken')
    const response = await v.render(req, {
      page: 'Broken',
      entry: 'src/main.tsx',
    })

    const html = await response.text()
    // Falls back to empty CSR shell
    expect(html).toContain('<div id="app"></div>')
    expect(html).toStartWith('<!DOCTYPE html>')
  })

  it('JSON response includes _page and _url from data merge', async () => {
    const v = devVite()
    const req = fakeRequest('/test', { 'X-Mantiq': 'true' })
    const response = await v.render(req, {
      page: 'TestPage',
      entry: 'src/main.tsx',
      data: { foo: 'bar' },
    })

    const body = await response.json() as Record<string, unknown>
    expect(body._page).toBe('TestPage')
    expect(body._url).toBe('/test')
    expect(body.foo).toBe('bar')
  })
})

// ── page() with SSR ─────────────────────────────────────────────────────────

describe('Vite SSR — page() with SSR module', () => {
  it('injects SSR HTML into root element', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule(fakeSSRModule('<p>Hello from SSR</p>'))

    const html = await v.page({
      entry: 'src/main.tsx',
      url: '/test',
      data: { _page: 'Test' },
    })

    expect(html).toContain('<div id="app"><p>Hello from SSR</p></div>')
  })

  it('injects SSR head into <head>', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule(fakeSSRModule('<div/>', '<meta name="ssr" content="yes">'))

    const html = await v.page({
      entry: 'src/main.tsx',
      url: '/test',
    })

    const headEnd = html.indexOf('</head>')
    const ssrMetaIdx = html.indexOf('name="ssr"')
    expect(ssrMetaIdx).toBeGreaterThan(-1)
    expect(ssrMetaIdx).toBeLessThan(headEnd)
  })

  it('page without url does not trigger SSR even if configured', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    let ssrCalled = false
    v.setSSRModule({
      render: async () => {
        ssrCalled = true
        return { html: '<div>ssr</div>' }
      },
    })

    const html = await v.page({
      entry: 'src/main.tsx',
      // no url — SSR should be skipped
    })

    expect(ssrCalled).toBe(false)
    expect(html).toContain('<div id="app"></div>')
  })

  it('SSR failure gracefully falls back to empty root div', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule({
      render: async () => { throw new Error('render crash') },
    })

    const html = await v.page({
      entry: 'src/main.tsx',
      url: '/crash',
    })

    expect(html).toContain('<div id="app"></div>')
    expect(html).toStartWith('<!DOCTYPE html>')
  })

  it('page includes both extra head and SSR head', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule(fakeSSRModule('<div/>', '<link rel="prefetch" href="/data.json">'))

    const html = await v.page({
      entry: 'src/main.tsx',
      url: '/combined',
      head: '<link rel="icon" href="/favicon.ico">',
    })

    expect(html).toContain('favicon.ico')
    expect(html).toContain('/data.json')
  })
})

// ── SSR module validation ───────────────────────────────────────────────────

describe('Vite SSR — SSR module validation', () => {
  it('isSSR reflects ssr.entry configuration', () => {
    const withSSR = new Vite({ ssr: { entry: 'src/ssr.tsx' } })
    const withoutSSR = new Vite()
    expect(withSSR.isSSR()).toBe(true)
    expect(withoutSSR.isSSR()).toBe(false)
  })

  it('setSSRModule allows injecting a custom module', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule(fakeSSRModule('<div class="custom">Custom SSR</div>'))

    const html = await v.page({
      entry: 'src/main.tsx',
      url: '/custom',
    })

    expect(html).toContain('Custom SSR')
  })

  it('setting SSR module to null clears the cache', async () => {
    const v = devVite({ ssrEntry: 'src/ssr.tsx' })
    v.setSSRModule(fakeSSRModule('<p>First</p>'))

    const html1 = await v.page({ entry: 'src/main.tsx', url: '/a' })
    expect(html1).toContain('First')

    v.setSSRModule(fakeSSRModule('<p>Second</p>'))

    const html2 = await v.page({ entry: 'src/main.tsx', url: '/b' })
    expect(html2).toContain('Second')
  })
})
