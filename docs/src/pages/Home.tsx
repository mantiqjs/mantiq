import { useState, useEffect, useRef } from 'react'
import {
  Github, Copy, Check, ArrowRight, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/layout/theme-toggle'

interface HomeProps {
  navigate: (href: string) => void
}

// Typing animation — uses a ref so Prism doesn't conflict with React
function TypedCode() {
  const codeRef = useRef<HTMLElement>(null)
  const [visibleLines, setVisibleLines] = useState(0)
  const [done, setDone] = useState(false)
  const lines = [
    `import { Application } from '@mantiq/core'`,
    ``,
    `const app = await Application.create(import.meta.dir)`,
    ``,
    `router.get('/users/:id', [UserController, 'show'])`,
    ``,
    `const admins = await User.where('role', 'admin').get()`,
    ``,
    `const data = await validate(request, {`,
    `  email: 'required|email|unique:users',`,
    `})`,
  ]

  useEffect(() => {
    if (visibleLines >= lines.length) {
      setDone(true)
      return
    }
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), 100)
    return () => clearTimeout(timer)
  }, [visibleLines, lines.length])

  // Write to DOM directly via ref — avoids React managing these text nodes
  useEffect(() => {
    const el = codeRef.current
    if (!el) return
    el.textContent = lines.slice(0, visibleLines).join('\n')
  }, [visibleLines])

  // Highlight only once, when typing is done
  useEffect(() => {
    if (!done || !codeRef.current) return
    if (typeof (window as any).Prism !== 'undefined') {
      ;(window as any).Prism.highlightElement(codeRef.current)
    }
  }, [done])

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b bg-muted/50">
        <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
        <span className="ml-2 text-[0.6875rem] text-muted-foreground font-mono">index.ts</span>
      </div>
      <pre className="!m-0 !rounded-none !border-0">
        <code ref={codeRef} className="language-typescript !text-[0.8125rem] !leading-[1.8] block p-5" />
      </pre>
    </div>
  )
}

export default function Home({ navigate }: HomeProps) {
  const [copied, setCopied] = useState(false)

  const copyInstall = () => {
    navigator.clipboard.writeText('bun create mantiq my-app')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl flex items-center justify-between h-14 px-6">
            <a
              href="/"
              className="flex items-center gap-2 text-foreground no-underline"
              onClick={(e) => { e.preventDefault(); navigate('/') }}
            >
              <span className="text-xl font-semibold tracking-tight"><span className="text-primary">.</span>mantiq</span>
            </a>
            <nav className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <a href="/docs/introduction">Docs</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://github.com/mantiqjs/mantiq" target="_blank" rel="noopener">
                  <Github className="h-4 w-4 mr-1.5" /> GitHub
                </a>
              </Button>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="pt-14">
          {/* ── Hero ────────────────────────────────────────────── */}
          <section className="relative">
            <div className="mx-auto max-w-5xl px-6">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-20 lg:py-28">
                {/* Left: copy */}
                <div>
                  <Badge
                    variant="outline"
                    className="mb-5 text-xs border-primary/30 text-primary"
                  >
                    <Sparkles className="h-3 w-3 mr-1.5" /> v0.1.0
                  </Badge>

                  <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground mb-5 leading-[1.1]">
                    The framework
                    <br />
                    for <span className="font-mono text-primary">Bun</span>.
                  </h1>

                  <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-md">
                    MantiqJS is a batteries-included TypeScript framework inspired by{' '}
                    <a href="https://laravel.com" target="_blank" rel="noopener" className="text-primary hover:underline">Laravel</a>.
                    Auth, ORM, queues, realtime, validation, mail, CLI &mdash; all built in, zero config.
                  </p>

                  {/* Install */}
                  <div className="flex flex-col sm:flex-row items-start gap-3 mb-8">
                    <button
                      onClick={copyInstall}
                      className="inline-flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-muted/50 hover:bg-muted transition-colors cursor-pointer font-mono text-sm"
                    >
                      <span className="text-muted-foreground select-none">$</span>
                      <span className="text-foreground">bun create mantiq my-app</span>
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button className="gap-2" asChild>
                      <a href="/docs/introduction">
                        Get Started <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" asChild>
                      <a href="/docs/installation">Installation</a>
                    </Button>
                  </div>
                </div>

                {/* Right: code */}
                <div className="lg:pl-4">
                  <TypedCode />
                </div>
              </div>
            </div>
          </section>

          {/* ── What's inside ───────────────────────────────────── */}
          <section className="border-t">
            <div className="mx-auto max-w-5xl px-6 py-20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-10">
                What&rsquo;s inside
              </p>

              <div className="grid sm:grid-cols-2 gap-x-16 gap-y-8">
                {[
                  ['@mantiq/core', 'IoC container, router, middleware, HTTP kernel, config, sessions, caching, encryption, hashing.'],
                  ['@mantiq/database', 'Active Record ORM, query builder, migrations, seeders, factories. SQLite, Postgres, MySQL, MSSQL, MongoDB.'],
                  ['@mantiq/auth', 'Session & request guards, remember-me, database user provider, 4 middleware.'],
                  ['@mantiq/validation', '40+ built-in rules, FormRequest, async database rules, custom extensions.'],
                  ['@mantiq/cli', '26 commands. Generators, migrations, REPL (tinker), dev server.'],
                  ['@mantiq/queue', 'Job dispatching with 5 drivers. Chains, batches, scheduling, retries.'],
                  ['@mantiq/realtime', 'WebSocket server with channels, presence, authorization. SSE fallback.'],
                  ['@mantiq/mail', '8 transports: SMTP, SES, SendGrid, Mailgun, Postmark, Resend. Markdown emails.'],
                ].map(([name, desc]) => (
                  <div key={name} className="group">
                    <h3 className="font-mono text-sm font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors">
                      {name}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t flex items-center gap-2 text-sm text-muted-foreground">
                <span>+ 8 more packages:</span>
                {['events', 'filesystem', 'logging', 'notify', 'helpers', 'vite', 'heartbeat', 'create-mantiq'].map((p) => (
                  <code key={p} className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">{p}</code>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA ─────────────────────────────────────────────── */}
          <section className="border-t">
            <div className="mx-auto max-w-3xl px-6 py-20 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-3">Ready to build?</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm">
                Scaffold a full app in seconds &mdash; auth, database, frontend, and CLI included.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button className="gap-2" asChild>
                  <a href="/docs/introduction">
                    Read the Docs <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <a href="https://github.com/mantiqjs/mantiq" target="_blank" rel="noopener">
                    <Github className="h-4 w-4" /> GitHub
                  </a>
                </Button>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t py-8 px-6">
            <div className="mx-auto max-w-5xl flex items-center justify-between text-xs text-muted-foreground">
              <span>MantiqJS &mdash; MIT License</span>
              <span>Built with MantiqJS</span>
            </div>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  )
}
