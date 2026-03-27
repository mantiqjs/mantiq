import { useState, useCallback } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import {
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  Box,
  Route,
  Database,
  Shield,
  CheckCircle,
  Zap,
  Terminal,
  Layers,
} from 'lucide-react'
import { Header } from '@/components/Header.tsx'
import { SearchDialog } from '@/components/SearchDialog.tsx'

const features = [
  {
    icon: Box,
    title: 'IoC Container',
    description: 'Dependency injection with auto-resolution, singleton/transient bindings, and full type safety.',
  },
  {
    icon: Route,
    title: 'Expressive Routing',
    description: 'Route groups, parameter constraints, resource routes, named routes, and middleware stacks.',
  },
  {
    icon: Database,
    title: 'Eloquent-Style ORM',
    description: 'Models with relationships, eager loading, soft deletes, casts, and a fluent query builder.',
  },
  {
    icon: Shield,
    title: 'Authentication',
    description: 'Session and token guards, user providers, middleware protection, and auth helpers.',
  },
  {
    icon: CheckCircle,
    title: 'Validation',
    description: '46 built-in rules, custom rule classes, FormRequest for controller-level validation.',
  },
  {
    icon: Zap,
    title: 'Built on Bun',
    description: 'Native Bun.serve, bun:sqlite, fast startup. No Node.js polyfills or compatibility layers.',
  },
  {
    icon: Terminal,
    title: 'CLI Tooling',
    description: '37 Artisan-style commands for code generation, migrations, seeding, and development.',
  },
  {
    icon: Layers,
    title: 'Vite + SSR',
    description: 'First-class Vite integration with HMR, React/Vue/Svelte SSR, and asset management.',
  },
]

const codeTabs = [
  {
    label: 'Routing',
    file: 'routes/api.ts',
    lines: [
      { text: "import type { Router } from", hl: " '@mantiq/core'" },
      { text: "import { PostController } from", hl: " '../app/Http/Controllers/PostController.ts'" },
      { text: '' },
      { text: 'export default function (router: Router) {', hl: '' },
      { text: "  router.get('/posts',", hl: " [PostController, 'index'])" },
      { text: "  router.post('/posts',", hl: " [PostController, 'store']).middleware('auth')" },
      { text: "  router.get('/posts/:id',", hl: " [PostController, 'show'])" },
      { text: "    .", hl: "whereNumber('id')" },
      { text: '}', hl: '' },
    ],
  },
  {
    label: 'Model',
    file: 'app/Models/User.ts',
    lines: [
      { text: "import { Model } from", hl: " '@mantiq/database'" },
      { text: "import { AuthenticatableModel } from", hl: " '@mantiq/auth'" },
      { text: '' },
      { text: 'export class User extends', hl: ' AuthenticatableModel(Model)' },
      { text: ' {', hl: '' },
      { text: "  static override fillable =", hl: " ['name', 'email', 'password']" },
      { text: "  static override hidden =", hl: " ['password', 'remember_token']" },
      { text: '}', hl: '' },
    ],
  },
  {
    label: 'Controller',
    file: 'app/Http/Controllers/PostController.ts',
    lines: [
      { text: "import type { MantiqRequest } from", hl: " '@mantiq/core'" },
      { text: "import { json } from", hl: " '@mantiq/core'" },
      { text: "import { Post } from", hl: " '../../Models/Post.ts'" },
      { text: '' },
      { text: 'export class PostController {', hl: '' },
      { text: '  async index(request: MantiqRequest) {', hl: '' },
      { text: '    const posts = await', hl: " Post.query().orderBy('id', 'desc').get()" },
      { text: '    return', hl: ' json({ data: posts })' },
      { text: '  }', hl: '' },
      { text: '}', hl: '' },
    ],
  },
  {
    label: 'Validation',
    file: 'app/Http/Requests/StorePostRequest.ts',
    lines: [
      { text: "import { FormRequest } from", hl: " '@mantiq/validation'" },
      { text: '' },
      { text: 'export class StorePostRequest extends FormRequest {', hl: '' },
      { text: '  override rules() {', hl: '' },
      { text: '    return {', hl: '' },
      { text: "      title:", hl: " 'required|string|min:3|max:200'," },
      { text: "      body:", hl: " 'required|string'," },
      { text: "      email:", hl: " 'required|email|unique:users'," },
      { text: '    }', hl: '' },
      { text: '  }', hl: '' },
      { text: '}', hl: '' },
    ],
  },
  {
    label: 'Migration',
    file: 'database/migrations/001_create_posts.ts',
    lines: [
      { text: "import { Migration } from", hl: " '@mantiq/database'" },
      { text: '' },
      { text: 'export default class extends Migration {', hl: '' },
      { text: '  override async up(schema) {', hl: '' },
      { text: "    await schema.create('posts', (t) => {", hl: '' },
      { text: '      t.id()', hl: '' },
      { text: "      t.string('title', 200)", hl: '' },
      { text: "      t.text('body')", hl: '' },
      { text: "      t.integer('user_id')", hl: '' },
      { text: '      t.timestamps()', hl: '' },
      { text: '    })', hl: '' },
      { text: '  }', hl: '' },
      { text: '}', hl: '' },
    ],
  },
  {
    label: 'Realtime',
    file: 'routes/channels.ts',
    lines: [
      { text: "import { realtime } from", hl: " '@mantiq/realtime'" },
      { text: '' },
      { text: 'export default function () {', hl: '' },
      { text: '  const ws =', hl: ' realtime()' },
      { text: '' },
      { text: "  ws.channels.authorize('room.*',", hl: ' async (userId, channel) => {' },
      { text: "    const roomId = channel.split('.')[1]", hl: '' },
      { text: '    return await', hl: ' isMember(userId, roomId)' },
      { text: '  })', hl: '' },
      { text: '}', hl: '' },
    ],
  },
]

function CodeShowcase() {
  const [activeTab, setActiveTab] = useState(0)
  const tab = codeTabs[activeTab]!

  return (
    <section className="relative px-6 py-12 lg:py-16">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="overflow-hidden rounded-2xl border border-border bg-zinc-950 shadow-2xl shadow-black/20 dark:border-zinc-800"
        >
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-zinc-800 overflow-x-auto">
            <div className="flex items-center gap-1.5 px-4 py-3 border-r border-zinc-800">
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            </div>
            {codeTabs.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setActiveTab(i)}
                className={`relative px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  i === activeTab
                    ? 'text-emerald-400 bg-zinc-900/50'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.label}
                {i === activeTab && (
                  <motion.div
                    layoutId="code-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-400"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Filename */}
          <div className="px-5 pt-3 pb-0">
            <span className="text-[11px] text-zinc-600 font-mono">{tab.file}</span>
          </div>

          {/* Code */}
          <div className="overflow-x-auto px-5 py-3 min-h-[260px]">
            <pre className="!m-0 !border-0 !bg-transparent !p-0">
              <code className="text-[13px] leading-[1.8]">
                {tab.lines.map((line, i) => (
                  <motion.div
                    key={`${activeTab}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="whitespace-pre"
                  >
                    {line.text === '' ? (
                      '\n'
                    ) : line.text.startsWith('//') ? (
                      <span className="text-zinc-600">{line.text}</span>
                    ) : (
                      <>
                        <span className="text-zinc-400">{line.text}</span>
                        {line.hl && <span className="text-emerald-400">{line.hl}</span>}
                      </>
                    )}
                  </motion.div>
                ))}
              </code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

interface HomeProps {
  appName?: string
  navigate: (href: string) => void
}

export default function Home({ navigate }: HomeProps) {
  const [copied, setCopied] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { scrollYProgress } = useScroll()
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -60])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText('bun create mantiq my-app')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <div className="gradient-bg min-h-screen">
      <Header onSearchOpen={() => setSearchOpen(true)} variant="home" />

      {/* Floating gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="animate-float absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-[0.07] dark:opacity-10"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }}
        />
        <div
          className="animate-float-slow absolute -right-24 top-1/4 h-[30rem] w-[30rem] rounded-full opacity-[0.04] dark:opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        />
        <div
          className="animate-float-slower absolute bottom-0 left-1/3 h-80 w-80 rounded-full opacity-[0.04] dark:opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
        />
      </div>

      {/* Hero Section */}
      <motion.section
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative flex flex-col items-center justify-center px-6 pt-32 pb-20 lg:pt-40 lg:pb-24"
      >
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              TypeScript framework for Bun
            </span>
          </motion.div>

          {/* Headline */}
          <h1 className="mt-8 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {['The', 'framework', 'for'].map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                className="mr-[0.3em] inline-block text-foreground"
              >
                {word}
              </motion.span>
            ))}
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="inline-block bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent"
            >
              Bun.
            </motion.span>
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            A batteries-included, Laravel-inspired TypeScript web framework.
            Routing, ORM, auth, validation, and CLI &mdash; all out of the box.
          </motion.p>

          {/* Install command */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.75 }}
            className="mt-8 flex justify-center"
          >
            <button
              onClick={handleCopy}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 font-mono text-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <span className="text-muted-foreground">$</span>
              <span className="text-foreground">bun create mantiq my-app</span>
              <span className="text-muted-foreground transition-colors group-hover:text-primary">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </span>
            </button>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="mt-8 flex flex-wrap justify-center gap-3"
          >
            <a
              href="/docs/introduction"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="https://github.com/mantiqjs/mantiq"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:scale-[1.02] hover:bg-muted active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              GitHub
            </a>
          </motion.div>
        </div>

      </motion.section>

      {/* Code Showcase Section */}
      <CodeShowcase />

      {/* Features Grid */}
      <section className="relative px-6 py-12 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-10 text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A complete toolkit for building production-ready applications.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{feature.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="border-t border-border px-6 py-8"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              <span className="text-primary">.</span>mantiq
            </span>
            <span className="mx-2">&middot;</span>
            The TypeScript framework for Bun
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/docs/introduction" className="transition-colors hover:text-foreground">
              Docs
            </a>
            <a
              href="https://github.com/mantiqjs/mantiq"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </motion.footer>

      <SearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        entries={[]}
        navigate={navigate}
      />
    </div>
  )
}
