import { describe, it, expect, beforeEach } from 'bun:test'
import { Vite, escapeHtml } from '../../src/Vite.ts'
import { ViteEntrypointNotFoundError, ViteManifestNotFoundError } from '../../src/errors/ViteError.ts'
import type { ViteManifest } from '../../src/contracts/Vite.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function devVite(opts: { reactRefresh?: boolean } = {}): Vite {
  const v = new Vite({ reactRefresh: opts.reactRefresh ?? false })
  v.setDevMode('http://localhost:5173')
  return v
}

function prodVite(manifest: ViteManifest): Vite {
  const v = new Vite({ buildDir: 'build' })
  v.setDevMode(false)
  v.setManifest(manifest)
  return v
}

// ── Dev Mode ─────────────────────────────────────────────────────────────────

describe('Vite — dev mode', () => {
  let v: Vite

  beforeEach(() => {
    v = devVite()
  })

  it('isDev() returns true when dev mode is set', () => {
    expect(v.isDev()).toBe(true)
  })

  it('devServerUrl() returns the cached URL', () => {
    expect(v.devServerUrl()).toBe('http://localhost:5173')
  })

  it('includes @vite/client script tag', async () => {
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('<script type="module" src="http://localhost:5173/@vite/client"></script>')
  })

  it('includes entrypoint as script tag', async () => {
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('<script type="module" src="http://localhost:5173/src/main.tsx"></script>')
  })

  it('handles multiple entrypoints', async () => {
    const html = await v.assets(['src/main.tsx', 'src/admin.tsx'])
    expect(html).toContain('src="http://localhost:5173/src/main.tsx"')
    expect(html).toContain('src="http://localhost:5173/src/admin.tsx"')
  })

  it('generates link tag for CSS entrypoints', async () => {
    const html = await v.assets(['src/main.tsx', 'src/style.css'])
    expect(html).toContain('<link rel="stylesheet" href="http://localhost:5173/src/style.css">')
    expect(html).toContain('<script type="module" src="http://localhost:5173/src/main.tsx">')
  })

  it('does not include React Refresh preamble by default', async () => {
    const html = await v.assets('src/main.tsx')
    expect(html).not.toContain('@react-refresh')
  })

  it('includes React Refresh preamble when enabled', async () => {
    const v2 = devVite({ reactRefresh: true })
    const html = await v2.assets('src/main.tsx')
    expect(html).toContain('@react-refresh')
    expect(html).toContain('__vite_plugin_react_preamble_installed__')
  })

  it('React Refresh preamble comes before @vite/client', async () => {
    const v2 = devVite({ reactRefresh: true })
    const html = await v2.assets('src/main.tsx')
    const refreshIdx = html.indexOf('@react-refresh')
    const clientIdx = html.indexOf('@vite/client')
    expect(refreshIdx).toBeLessThan(clientIdx)
  })

  it('handles Vue entrypoints', async () => {
    const html = await v.assets('src/main.ts')
    expect(html).toContain('src="http://localhost:5173/src/main.ts"')
  })

  it('handles Svelte entrypoints', async () => {
    const html = await v.assets('src/main.js')
    expect(html).toContain('src="http://localhost:5173/src/main.js"')
  })
})

// ── Prod Mode ────────────────────────────────────────────────────────────────

describe('Vite — prod mode', () => {
  const simpleManifest: ViteManifest = {
    'src/main.tsx': {
      file: 'assets/main-abc123.js',
      src: 'src/main.tsx',
      isEntry: true,
      css: ['assets/main-def456.css'],
    },
  }

  it('isDev() returns false', () => {
    const v = prodVite(simpleManifest)
    expect(v.isDev()).toBe(false)
  })

  it('generates script tag with hashed path', async () => {
    const v = prodVite(simpleManifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('<script type="module" src="/build/assets/main-abc123.js"></script>')
  })

  it('generates link tag for CSS from manifest', async () => {
    const v = prodVite(simpleManifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('<link rel="stylesheet" href="/build/assets/main-def456.css">')
  })

  it('CSS appears before script tag', async () => {
    const v = prodVite(simpleManifest)
    const html = await v.assets('src/main.tsx')
    const cssIdx = html.indexOf('link rel="stylesheet"')
    const scriptIdx = html.indexOf('script type="module"')
    expect(cssIdx).toBeLessThan(scriptIdx)
  })

  it('collects transitive CSS from imported chunks', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main-111.js',
        isEntry: true,
        imports: ['src/shared.tsx'],
      },
      'src/shared.tsx': {
        file: 'assets/shared-222.js',
        css: ['assets/shared-333.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('href="/build/assets/shared-333.css"')
  })

  it('generates modulepreload tags for imported chunks', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main-111.js',
        isEntry: true,
        imports: ['src/vendor.tsx'],
      },
      'src/vendor.tsx': {
        file: 'assets/vendor-222.js',
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('<link rel="modulepreload" href="/build/assets/vendor-222.js">')
  })

  it('does not modulepreload the entry itself', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main-111.js',
        isEntry: true,
        imports: ['src/vendor.tsx'],
      },
      'src/vendor.tsx': {
        file: 'assets/vendor-222.js',
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).not.toContain('modulepreload" href="/build/assets/main-111.js"')
  })

  it('de-duplicates CSS across multiple entrypoints', async () => {
    const manifest: ViteManifest = {
      'src/app.tsx': {
        file: 'assets/app-111.js',
        isEntry: true,
        css: ['assets/shared.css'],
      },
      'src/admin.tsx': {
        file: 'assets/admin-222.js',
        isEntry: true,
        css: ['assets/shared.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets(['src/app.tsx', 'src/admin.tsx'])
    const matches = html.match(/shared\.css/g)
    expect(matches?.length).toBe(1)
  })

  it('handles CSS-only entrypoints', async () => {
    const manifest: ViteManifest = {
      'src/style.css': {
        file: 'assets/style-abc.css',
        src: 'src/style.css',
        isEntry: true,
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/style.css')
    // CSS-only entry should produce a <link> tag, not a <script> tag
    expect(html).not.toContain('<script')
    expect(html).toContain('<link rel="stylesheet" href="/build/assets/style-abc.css">')
  })

  it('throws ViteEntrypointNotFoundError for missing entrypoint', async () => {
    const v = prodVite(simpleManifest)
    expect(v.assets('src/missing.tsx')).rejects.toBeInstanceOf(ViteEntrypointNotFoundError)
  })

  it('deeply transitive CSS is collected', async () => {
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
        css: ['assets/deep.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('deep.css')
  })

  it('handles circular imports without infinite loop', async () => {
    const manifest: ViteManifest = {
      'src/main.tsx': {
        file: 'assets/main.js',
        isEntry: true,
        imports: ['src/a.tsx'],
      },
      'src/a.tsx': {
        file: 'assets/a.js',
        imports: ['src/main.tsx'],
        css: ['assets/a.css'],
      },
    }
    const v = prodVite(manifest)
    const html = await v.assets('src/main.tsx')
    expect(html).toContain('a.css')
  })
})

// ── Manifest Loading ─────────────────────────────────────────────────────────

describe('Vite — manifest loading', () => {
  it('throws ViteManifestNotFoundError for missing manifest', async () => {
    const v = new Vite({ publicDir: '/tmp/nonexistent-mantiq-test' })
    v.setDevMode(false)
    expect(v.loadManifest()).rejects.toBeInstanceOf(ViteManifestNotFoundError)
  })

  it('flushManifest clears the cache', async () => {
    const manifest: ViteManifest = { 'x.js': { file: 'x-1.js' } }
    const v = prodVite(manifest)

    // First call uses the cache
    const m1 = await v.loadManifest()
    expect(m1).toEqual(manifest)

    // Flush and set new manifest
    v.flushManifest()
    const newManifest: ViteManifest = { 'y.js': { file: 'y-2.js' } }
    v.setManifest(newManifest)

    const m2 = await v.loadManifest()
    expect(m2).toEqual(newManifest)
  })
})

// ── page() HTML Shell ────────────────────────────────────────────────────────

describe('Vite — page()', () => {
  it('returns valid HTML document', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).toStartWith('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('</html>')
  })

  it('sets the title', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx', title: 'My App' })
    expect(html).toContain('<title>My App</title>')
  })

  it('escapes title for XSS prevention', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx', title: '<script>alert("xss")</script>' })
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('includes default root element div', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).toContain('<div id="app"></div>')
  })

  it('supports custom root element', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx', rootElement: 'root' })
    expect(html).toContain('<div id="root"></div>')
  })

  it('injects window.__MANTIQ_DATA__ when data is provided', async () => {
    const v = devVite()
    const html = await v.page({
      entry: 'src/main.tsx',
      data: { users: [{ id: 1, name: 'Alice' }] },
    })
    expect(html).toContain('window.__MANTIQ_DATA__')
    expect(html).toContain('"users"')
    expect(html).toContain('"Alice"')
  })

  it('does not inject __MANTIQ_DATA__ when data is omitted', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).not.toContain('__MANTIQ_DATA__')
  })

  it('injects extra head content', async () => {
    const v = devVite()
    const html = await v.page({
      entry: 'src/main.tsx',
      head: '<link rel="icon" href="/favicon.ico">',
    })
    expect(html).toContain('<link rel="icon" href="/favicon.ico">')
  })

  it('includes asset tags', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).toContain('@vite/client')
    expect(html).toContain('src/main.tsx')
  })

  it('works in prod mode with manifest', async () => {
    const v = prodVite({
      'src/main.tsx': {
        file: 'assets/main-abc.js',
        isEntry: true,
        css: ['assets/main-def.css'],
      },
    })
    const html = await v.page({ entry: 'src/main.tsx', title: 'Prod' })
    expect(html).toContain('main-abc.js')
    expect(html).toContain('main-def.css')
    expect(html).toContain('<title>Prod</title>')
  })

  it('includes meta viewport tag', async () => {
    const v = devVite()
    const html = await v.page({ entry: 'src/main.tsx' })
    expect(html).toContain('viewport')
    expect(html).toContain('width=device-width')
  })
})

// ── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes < and >', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;')
  })

  it('escapes &', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('does not escape safe strings', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

// ── getConfig ────────────────────────────────────────────────────────────────

describe('Vite — getConfig()', () => {
  it('returns default config when none provided', () => {
    const v = new Vite()
    const cfg = v.getConfig()
    expect(cfg.devServerUrl).toBe('http://localhost:5173')
    expect(cfg.buildDir).toBe('build')
    expect(cfg.publicDir).toBe('public')
    expect(cfg.manifest).toBe('.vite/manifest.json')
    expect(cfg.reactRefresh).toBe(false)
    expect(cfg.rootElement).toBe('app')
    expect(cfg.hotFile).toBe('hot')
  })

  it('merges partial config with defaults', () => {
    const v = new Vite({ buildDir: 'dist', reactRefresh: true })
    const cfg = v.getConfig()
    expect(cfg.buildDir).toBe('dist')
    expect(cfg.reactRefresh).toBe(true)
    expect(cfg.devServerUrl).toBe('http://localhost:5173') // default
  })
})

// ── reactRefreshTag ──────────────────────────────────────────────────────────

describe('Vite — reactRefreshTag()', () => {
  it('includes import from @react-refresh', () => {
    const v = devVite()
    const tag = v.reactRefreshTag()
    expect(tag).toContain("from 'http://localhost:5173/@react-refresh'")
  })

  it('includes preamble setup code', () => {
    const v = devVite()
    const tag = v.reactRefreshTag()
    expect(tag).toContain('injectIntoGlobalHook')
    expect(tag).toContain('$RefreshReg$')
    expect(tag).toContain('$RefreshSig$')
  })
})
