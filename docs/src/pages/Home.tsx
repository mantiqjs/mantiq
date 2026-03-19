export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border-0 bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[90rem] flex items-center justify-between h-14 px-6">
          <a href="/" className="flex items-center gap-2.5 text-text-0 no-underline">
            <span className="font-mono text-lg font-bold tracking-tight">mantiq</span>
          </a>
          <nav className="flex items-center gap-6 text-sm">
            <a href="/docs/introduction" className="text-text-1 hover:text-text-0 transition-colors no-underline">Docs</a>
            <a href="https://github.com/nicksona/mantiq" target="_blank" rel="noopener" className="text-text-1 hover:text-text-0 transition-colors no-underline">GitHub</a>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <main className="hero-gradient pt-14">
        <div className="mx-auto max-w-3xl px-6 pt-28 pb-20 text-center">
          <div className="mb-6">
            <span className="font-mono text-5xl font-black tracking-tight text-text-0">mantiq</span>
          </div>

          <p className="text-xl text-text-1 max-w-xl mx-auto leading-relaxed mb-8">
            The productive TypeScript framework. Batteries included, convention over configuration, built for Bun.
          </p>

          <div className="flex flex-col items-center gap-5 mb-16">
            <div className="install-box">
              <span className="prompt">$</span>
              <span>bun create mantiq my-app</span>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="/docs/introduction"
                className="inline-flex items-center px-5 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-dim transition-colors no-underline"
              >
                Get Started
              </a>
              <a
                href="/docs/installation"
                className="inline-flex items-center px-5 py-2 rounded-lg border border-border-0 text-text-1 font-medium text-sm hover:border-border-1 hover:text-text-0 transition-colors no-underline"
              >
                Installation
              </a>
            </div>
          </div>

          {/* ── Code Preview ──────────────────────────────────────── */}
          <div className="text-left max-w-2xl mx-auto mb-20">
            <pre className="!rounded-xl !border-border-0 !bg-surface-1 overflow-x-auto"><code className="language-typescript !text-[0.8125rem] !leading-[1.7] block p-6">{`import { Application, CoreServiceProvider } from '@mantiq/core'

const app = await Application.create(import.meta.dir, 'config')

// Register a route
router.get('/users/:id', [UserController, 'show'])

// Query the database
const users = await User.where('role', 'admin').get()

// Validate input
const data = await validator.validate()`}</code></pre>
          </div>
        </div>

        {/* ── Feature Cards ───────────────────────────────────────── */}
        <div className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="feature-card">
              <h3>Batteries Included</h3>
              <p>Auth, database, validation, SSR, file storage, caching, sessions, encryption — all built in.</p>
            </div>
            <div className="feature-card">
              <h3>Type-Safe</h3>
              <p>Full TypeScript from container bindings to query results. Class-based IoC, no string keys.</p>
            </div>
            <div className="feature-card">
              <h3>Convention Over Config</h3>
              <p>Sensible defaults everywhere. Spend time building features, not configuring boilerplate.</p>
            </div>
            <div className="feature-card">
              <h3>Built for Bun</h3>
              <p>Native Bun runtime. SQLite built-in, fast startup, no Node compatibility shims.</p>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="border-t border-border-0 py-8 px-6">
          <div className="mx-auto max-w-5xl flex items-center justify-between text-xs text-text-2">
            <span>MantiqJS — MIT License</span>
            <span>Built with MantiqJS</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
