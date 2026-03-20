import type { TemplateContext } from '../templates.ts'

export function getShadcnTemplates(ctx: TemplateContext): {
  files: Record<string, string>
  dependencies: Record<string, string>
} {
  return {
    files: {
      // ── tsconfig override with @/ path alias ──────────────────────────────
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'bundler',
          lib: ['ESNext', 'DOM', 'DOM.Iterable'],
          types: ['bun-types'],
          jsx: 'react-jsx',
          strict: true,
          noImplicitAny: true,
          strictNullChecks: true,
          noUncheckedIndexedAccess: true,
          noImplicitOverride: true,
          allowImportingTsExtensions: true,
          noEmit: true,
          skipLibCheck: true,
          baseUrl: '.',
          paths: { '@/*': ['./src/*'] },
        },
        include: ['./**/*'],
        exclude: ['node_modules'],
      }, null, 2) + '\n',

      // ── cn helper ───────────────────────────────────────────────────────────
      'src/lib/utils.ts': `import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`,

      // ── shadcn config ───────────────────────────────────────────────────────
      'components.json': JSON.stringify({
        '$schema': 'https://ui.shadcn.com/schema.json',
        style: 'new-york',
        rsc: false,
        tsx: true,
        tailwind: {
          config: '',
          css: 'src/style.css',
          baseColor: 'zinc',
          cssVariables: true,
        },
        aliases: {
          components: '@/components',
          utils: '@/lib/utils',
          ui: '@/components/ui',
          lib: '@/lib',
          hooks: '@/hooks',
        },
      }, null, 2) + '\n',

      // ── style.css — shadcn theme tokens ─────────────────────────────────────
      'src/style.css': `@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

/*
 * shadcn/ui theme — default: emerald
 *
 * To swap themes, visit https://ui.shadcn.com/themes
 * Pick a theme, copy the CSS variables, and replace
 * the :root and .dark blocks below.
 *
 * Or install a community theme:
 *   bunx --bun shadcn@latest add @ss-themes/caffeine
 */

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.521 0.155 163.22);
  --primary-foreground: oklch(0.982 0.018 163.22);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --accent: oklch(0.967 0.001 286.375);
  --accent-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.521 0.155 163.22);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.714);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.141 0.005 285.823);
  --sidebar-primary: oklch(0.521 0.155 163.22);
  --sidebar-primary-foreground: oklch(0.982 0.018 163.22);
  --sidebar-accent: oklch(0.967 0.001 286.375);
  --sidebar-accent-foreground: oklch(0.21 0.006 285.885);
  --sidebar-border: oklch(0.92 0.004 286.32);
  --sidebar-ring: oklch(0.521 0.155 163.22);
}

.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.141 0.005 285.823);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.141 0.005 285.823);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.648 0.2 163.22);
  --primary-foreground: oklch(0.21 0.066 163.22);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.274 0.006 286.033);
  --muted-foreground: oklch(0.705 0.015 286.067);
  --accent: oklch(0.274 0.006 286.033);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.704 0.191 22.216);
  --border: oklch(0.274 0.006 286.033);
  --input: oklch(0.274 0.006 286.033);
  --ring: oklch(0.648 0.2 163.22);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.18 0.007 285.823);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.648 0.2 163.22);
  --sidebar-primary-foreground: oklch(0.21 0.066 163.22);
  --sidebar-accent: oklch(0.274 0.006 286.033);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.274 0.006 286.033);
  --sidebar-ring: oklch(0.648 0.2 163.22);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fadeUp 0.4s ease-out; }
`,

      // Components (button, input, label, card, badge, table, avatar,
      // separator, sidebar, etc.) are installed by the shadcn CLI during
      // scaffold — no hand-rolled templates needed.

      // ── Login page (shadcn) ─────────────────────────────────────────────────
      'src/pages/Login.tsx': `import { useState } from 'react'
import { post } from '../lib/api.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface LoginProps {
  appName?: string
  navigate: (href: string) => void
  [key: string]: any
}

export default function Login({ appName = '${ctx.name}', navigate }: LoginProps) {
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { ok, data } = await post('/login', { email, password })
    if (ok) navigate('/dashboard')
    else setError(data?.error ?? 'Login failed')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="animate-fade-up w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-lg font-semibold text-foreground">{appName}</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3.5 py-2.5 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground text-center">
                Don't have an account?{' '}
                <a href="/register" className="text-primary hover:text-primary/80 font-medium">
                  Register
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
`,

      // ── Register page (shadcn) ──────────────────────────────────────────────
      'src/pages/Register.tsx': `import { useState } from 'react'
import { post } from '../lib/api.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface RegisterProps {
  appName?: string
  navigate: (href: string) => void
  [key: string]: any
}

export default function Register({ appName = '${ctx.name}', navigate }: RegisterProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { ok, data } = await post('/register', { name, email, password })
    if (ok) navigate('/dashboard')
    else setError(data?.error?.message ?? data?.error ?? 'Registration failed')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="animate-fade-up w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-lg font-semibold text-foreground">{appName}</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create an account</CardTitle>
            <CardDescription>Get started with {appName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3.5 py-2.5 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Create a password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create account'}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{' '}
                <a href="/login" className="text-primary hover:text-primary/80 font-medium">
                  Sign in
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
`,

      // ── Dashboard page (shadcn) ─────────────────────────────────────────────
      'src/pages/Dashboard.tsx': `import { useState, useEffect, useCallback } from 'react'
import { api, post } from '../lib/api.ts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface User { id: number; name: string; email: string; role: string }

interface DashboardProps {
  appName?: string
  currentUser?: User | null
  users?: User[]
  navigate: (href: string) => void
  [key: string]: any
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function Dashboard({ appName = '${ctx.name}', currentUser, users: initialUsers, navigate }: DashboardProps) {
  const [users, setUsers] = useState<User[]>(initialUsers ?? [])
  const [loading, setLoading] = useState(!initialUsers?.length)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
  )

  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    setIsDark(dark)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await api('/api/users')
    if (ok) setUsers(data.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!initialUsers?.length) fetchUsers()
  }, [fetchUsers, initialUsers])

  const handleLogout = async () => {
    await post('/logout', {})
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={\`fixed inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 \${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}\`}>
        <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
          <span className="text-sm font-semibold text-sidebar-foreground">{appName}</span>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-2.5 bg-sidebar-accent text-sidebar-accent-foreground" asChild>
            <a href="/dashboard">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              Dashboard
            </a>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2.5 text-sidebar-foreground/60 hover:text-sidebar-foreground" asChild>
            <a href="#users-section" onClick={(e) => { e.preventDefault(); document.getElementById('users-section')?.scrollIntoView({ behavior: 'smooth' }); setSidebarOpen(false) }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              Users
            </a>
          </Button>
        </nav>
        <Separator />
        <div className="px-3 py-3 space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-2.5 text-sidebar-foreground/60 hover:text-sidebar-foreground" asChild>
            <a href="/_heartbeat">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
              Heartbeat
            </a>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2.5 text-sidebar-foreground/60 hover:text-sidebar-foreground" asChild>
            <a href="/api/ping">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              API Ping
            </a>
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-60">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-background/90 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </Button>
            <h1 className="text-sm font-medium text-foreground">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {currentUser?.name ? getInitials(currentUser.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground hidden sm:inline">{currentUser?.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 lg:p-6 space-y-6 animate-fade-up">
          <Card>
            <CardHeader>
              <CardTitle>Welcome back, {currentUser?.name}</CardTitle>
              <CardDescription>Here's what's happening with your application.</CardDescription>
            </CardHeader>
          </Card>

          <Card id="users-section">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">Users</CardTitle>
                <CardDescription>{loading ? 'Loading...' : \`\${users.length} total\`}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px]">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px] bg-muted">
                              {getInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
`,
    },

    dependencies: {
      'clsx': '^2.1.0',
      'tailwind-merge': '^2.6.0',
      'class-variance-authority': '^0.7.0',
      'lucide-react': '^0.460.0',
    },
  }
}
