import type { TemplateContext } from '../templates.ts'

export function getShadcnTemplates(ctx: TemplateContext): {
  files: Record<string, string>
  dependencies: Record<string, string>
} {
  return {
    files: {
      // ── vite config override with @/ resolve alias ────────────────────────
      'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'public/build',
    manifest: true,
    emptyOutDir: true,
    rollupOptions: {
      input: ['src/main.tsx', 'src/style.css'],
    },
  },
})
`,

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
      // separator, dropdown-menu, sheet, tooltip, sidebar) are installed
      // by the shadcn CLI during scaffold — no hand-rolled templates needed.

      // ── Login page (shadcn) ─────────────────────────────────────────────────
      'src/pages/Login.tsx': `import { useState } from 'react'
import { post } from '../lib/api.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { LogIn } from 'lucide-react'

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
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
                  autoComplete="email"
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
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  'Signing in\u2026'
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate('/register')}>
                Register
              </Button>
            </p>
          </CardFooter>
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus } from 'lucide-react'

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
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Create an account</CardTitle>
            <CardDescription>Get started with {appName}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
                  autoComplete="name"
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
                  autoComplete="email"
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
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  'Creating account\u2026'
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create account
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </p>
          </CardFooter>
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Home,
  Users,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  Menu,
  Github,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Activity,
  Zap,
  TrendingUp,
  UserCheck,
  UserPlus,
  Shield,
} from 'lucide-react'

interface UserRecord {
  id: number
  name: string
  email: string
  role: string
}

interface DashboardProps {
  appName?: string
  currentUser?: UserRecord | null
  users?: UserRecord[]
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

/* ── Sidebar nav items ────────────────────────────────────────────────────── */
const mainNav = [
  { label: 'Dashboard', icon: Home, href: '/dashboard', active: true },
  { label: 'Users', icon: Users, href: '#users-section', scroll: true },
]
const secondaryNav = [
  { label: 'Heartbeat', icon: Activity, href: '/_heartbeat' },
  { label: 'API Ping', icon: Zap, href: '/api/ping' },
]

/* ── Sidebar content (shared between desktop aside & mobile Sheet) ──────── */
function SidebarNav({
  appName,
  collapsed,
  onToggle,
  onNavigate,
}: {
  appName: string
  collapsed: boolean
  onToggle: () => void
  onNavigate?: () => void
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        {/* Brand */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-3">
          {!collapsed && (
            <span className="flex-1 truncate pl-2 text-sm font-semibold">{appName}</span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                onClick={onToggle}
              >
                {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
          </Tooltip>
        </div>

        {/* Main nav */}
        <nav className="flex-1 space-y-1 px-2 py-3">
          {mainNav.map((item) => {
            const Icon = item.icon
            const btn = (
              <Button
                key={item.label}
                variant="ghost"
                className={\`w-full \${collapsed ? 'justify-center px-0' : 'justify-start gap-3'} \${
                  item.active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }\`}
                asChild
              >
                <a
                  href={item.href}
                  onClick={
                    item.scroll
                      ? (e: React.MouseEvent) => {
                          e.preventDefault()
                          document.getElementById('users-section')?.scrollIntoView({ behavior: 'smooth' })
                          onNavigate?.()
                        }
                      : onNavigate
                        ? (e: React.MouseEvent) => { onNavigate() }
                        : undefined
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && item.label}
                </a>
              </Button>
            )
            if (collapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }
            return btn
          })}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* Secondary nav */}
        <div className="space-y-1 px-2 py-3">
          {secondaryNav.map((item) => {
            const Icon = item.icon
            const btn = (
              <Button
                key={item.label}
                variant="ghost"
                className={\`w-full \${collapsed ? 'justify-center px-0' : 'justify-start gap-3'} text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground\`}
                asChild
              >
                <a href={item.href} onClick={onNavigate ? () => onNavigate() : undefined}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && item.label}
                </a>
              </Button>
            )
            if (collapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }
            return btn
          })}
        </div>

        {/* GitHub link */}
        <div className="border-t border-sidebar-border px-2 py-3">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground" asChild>
                  <a href="https://github.com" target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">GitHub</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground" asChild>
              <a href="https://github.com" target="_blank" rel="noreferrer">
                <Github className="h-4 w-4 shrink-0" />
                GitHub
              </a>
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default function Dashboard({
  appName = '${ctx.name}',
  currentUser,
  users: initialUsers,
  navigate,
}: DashboardProps) {
  const [users, setUsers] = useState<UserRecord[]>(initialUsers ?? [])
  const [loading, setLoading] = useState(!initialUsers?.length)
  const [collapsed, setCollapsed] = useState(false)
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true,
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

  /* Stats — derived from real user data + mock extras */
  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, change: '+12%' },
    { label: 'Active Now', value: Math.max(1, Math.ceil(users.length * 0.6)), icon: UserCheck, change: '+3%' },
    { label: 'New Today', value: Math.min(users.length, 2), icon: UserPlus, change: '+18%' },
    { label: 'Admin Users', value: users.filter((u) => u.role === 'admin').length, icon: Shield, change: '0%' },
  ]

  const sidebarWidth = collapsed ? 'w-16' : 'w-60'

  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside
        className={\`fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border transition-all duration-200 lg:block \${sidebarWidth}\`}
      >
        <SidebarNav
          appName={appName}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className={\`transition-all duration-200 \${collapsed ? 'lg:ml-16' : 'lg:ml-60'}\`}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger via Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle sidebar</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0">
                <SidebarNav
                  appName={appName}
                  collapsed={false}
                  onToggle={() => {}}
                />
              </SheetContent>
            </Sheet>
            <h1 className="text-sm font-medium text-foreground">Dashboard</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleTheme}>
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Account dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                      {currentUser?.name ? getInitials(currentUser.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline-block">
                    {currentUser?.name}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:inline-block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUser?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{currentUser?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="animate-fade-up space-y-6 p-4 lg:p-6">
          {/* Welcome card */}
          <Card>
            <CardHeader>
              <CardTitle>Welcome back, {currentUser?.name}</CardTitle>
              <CardDescription>
                Here's what's happening with your application today.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Stats row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.label}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardDescription className="text-sm font-medium">{stat.label}</CardDescription>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      {stat.change} from last month
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Users table */}
          <Card id="users-section">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">Users</CardTitle>
                <CardDescription>
                  {loading ? 'Loading\u2026' : \`\${users.length} registered user\${users.length === 1 ? '' : 's'}\`}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px]">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-muted text-xs">
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
                        No users found.
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
