import { useState } from 'react'
import { Book, Github, Copy, Check, Terminal, Shield, Zap, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/layout/theme-toggle'

interface HomeProps {
  navigate: (href: string) => void
}

const FEATURES = [
  {
    icon: Terminal,
    title: 'Batteries Included',
    description: 'Auth, database, validation, SSR, file storage, caching, sessions, encryption — all built in.',
  },
  {
    icon: Shield,
    title: 'Type-Safe',
    description: 'Full TypeScript from container bindings to query results. Class-based IoC, no string keys.',
  },
  {
    icon: Settings,
    title: 'Convention Over Config',
    description: 'Sensible defaults everywhere. Spend time building features, not configuring boilerplate.',
  },
  {
    icon: Zap,
    title: 'Built for Bun',
    description: 'Native Bun runtime. SQLite built-in, fast startup, no Node compatibility shims.',
  },
]

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
              <Book className="h-5 w-5 text-primary" />
              <span className="font-mono text-lg font-bold tracking-tight">mantiq</span>
            </a>
            <nav className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <a href="/docs/introduction">Docs</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://github.com/nicksona/mantiq" target="_blank" rel="noopener">
                  <Github className="h-4 w-4 mr-1" /> GitHub
                </a>
              </Button>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        {/* Hero */}
        <main className="pt-14">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.521_0.155_163.22/0.08),transparent_70%)]" />
            <div className="relative mx-auto max-w-3xl px-6 pt-28 pb-20 text-center">
              <Badge variant="secondary" className="mb-6">
                v0.1.0 — Now available
              </Badge>

              <h1 className="text-5xl font-black tracking-tight text-foreground mb-4">
                <span className="font-mono">mantiq</span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
                The productive TypeScript framework. Batteries included, convention over configuration, built for Bun.
              </p>

              <div className="flex flex-col items-center gap-5 mb-16">
                {/* Install command */}
                <Card
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={copyInstall}
                >
                  <CardContent className="flex items-center gap-3 px-5 py-3">
                    <span className="text-muted-foreground select-none">$</span>
                    <code className="font-mono text-sm text-foreground">bun create mantiq my-app</code>
                    {copied ? (
                      <Check className="h-4 w-4 text-primary ml-2" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground ml-2" />
                    )}
                  </CardContent>
                </Card>

                <div className="flex items-center gap-3">
                  <Button size="lg" asChild>
                    <a href="/docs/introduction">Get Started</a>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <a href="/docs/installation">Installation</a>
                  </Button>
                </div>
              </div>

              {/* Code Preview */}
              <div className="text-left max-w-2xl mx-auto mb-20">
                <pre className="rounded-xl border bg-muted overflow-x-auto">
                  <code className="language-typescript text-[0.8125rem] leading-[1.7] block p-6 text-muted-foreground">{`import { Application, CoreServiceProvider } from '@mantiq/core'

const app = await Application.create(import.meta.dir, 'config')

// Register a route
router.get('/users/:id', [UserController, 'show'])

// Query the database
const users = await User.where('role', 'admin').get()

// Validate input
const data = await validator.validate()`}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mx-auto max-w-5xl px-6 pb-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="hover:border-primary/20 transition-colors">
                  <CardHeader className="pb-2">
                    <feature.icon className="h-5 w-5 text-primary mb-2" />
                    <CardTitle className="text-sm">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t py-8 px-6">
            <div className="mx-auto max-w-5xl flex items-center justify-between text-xs text-muted-foreground">
              <span>MantiqJS — MIT License</span>
              <span>Built with MantiqJS</span>
            </div>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  )
}
