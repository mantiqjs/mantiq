import type { TemplateContext } from '../templates.ts'

export function getReactTemplates(ctx: TemplateContext): Record<string, string> {
  return {
    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: false,
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

    'src/style.css': `@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fadeUp 0.4s ease-out; }
`,

    'src/pages.ts': `import Login from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import Dashboard from './pages/Dashboard.tsx'

export const pages: Record<string, React.ComponentType<any>> = {
  Login,
  Register,
  Dashboard,
}
`,

    'src/lib/api.ts': `export async function api<T = any>(url: string, opts: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } })
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  return { ok: res.ok, status: res.status, data }
}

export function post(url: string, body: object) {
  return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
`,

    'src/main.tsx': `import './style.css'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

const root = document.getElementById('app')!
const app = <MantiqApp pages={pages} />

// Hydrate if SSR content exists, otherwise CSR mount
root.innerHTML.trim() ? hydrateRoot(root, app) : createRoot(root).render(app)
`,

    'src/ssr.tsx': `import { renderToString } from 'react-dom/server'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

export function render(_url: string, data?: Record<string, any>) {
  return { html: renderToString(<MantiqApp pages={pages} initialData={data} />) }
}
`,

    'src/App.tsx': `import { useState, useCallback, useEffect } from 'react'

interface MantiqAppProps {
  pages: Record<string, React.ComponentType<any>>
  initialData?: Record<string, any>
}

function initTheme() {
  if (typeof window === 'undefined') return
  const theme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

initTheme()

export function MantiqApp({ pages, initialData }: MantiqAppProps) {
  const windowData = typeof window !== 'undefined' ? (window as any).__MANTIQ_DATA__ : {}
  const initial = initialData ?? windowData
  const [page, setPage] = useState<string>(initial._page ?? 'Login')
  const [data, setData] = useState<Record<string, any>>(initial)

  const navigate = useCallback(async (href: string) => {
    const res = await fetch(href, {
      headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
    })
    const newData = await res.json()
    setPage(newData._page)
    setData(newData)
    history.pushState(null, '', newData._url)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      const href = anchor?.getAttribute('href')
      if (!href?.startsWith('/') || anchor?.target || e.ctrlKey || e.metaKey) return
      // Only intercept known SPA routes — let other links navigate normally
      const spaRoutes = ['/login', '/register', '/dashboard']
      if (!spaRoutes.some(r => href === r || href.startsWith(r + '?'))) return
      e.preventDefault()
      navigate(href)
    }
    const handlePop = () => navigate(location.pathname)
    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePop)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePop)
    }
  }, [navigate])

  const Page = pages[page]
  return Page ? <Page {...data} navigate={navigate} /> : null
}
`,

    'src/pages/Login.tsx': `import { useState } from 'react'
import { post } from '../lib/api.ts'

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
    e.preventDefault(); setError(''); setLoading(true)
    const { ok, data } = await post('/login', { email, password })
    if (ok) navigate('/dashboard')
    else setError(data?.error ?? 'Login failed')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="animate-fade-up w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{appName}</h2>
        </div>
        <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-8 space-y-6 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your account</p>
          </div>
          {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 transition-all" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Don't have an account? <a href="/register" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium">Register</a>
          </p>
        </div>
      </div>
    </div>
  )
}
`,

    'src/pages/Register.tsx': `import { useState } from 'react'
import { post } from '../lib/api.ts'

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
    e.preventDefault(); setError(''); setLoading(true)
    const { ok, data } = await post('/register', { name, email, password })
    if (ok) navigate('/dashboard')
    else setError(data?.error?.message ?? data?.error ?? 'Registration failed')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="animate-fade-up w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{appName}</h2>
        </div>
        <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-8 space-y-6 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create an account</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Get started with {appName}</p>
          </div>
          {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 transition-all" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Already have an account? <a href="/login" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
`,

    'src/pages/Dashboard.tsx': `import { useState, useEffect, useCallback } from 'react'
import { api, post } from '../lib/api.ts'

interface User { id: number; name: string; email: string; role: string }

interface DashboardProps {
  appName?: string
  currentUser?: User | null
  users?: User[]
  navigate: (href: string) => void
  [key: string]: any
}

export default function Dashboard({ appName = '${ctx.name}', currentUser, users: initialUsers, navigate }: DashboardProps) {
  const [users, setUsers] = useState<User[]>(initialUsers ?? [])
  const [loading, setLoading] = useState(!initialUsers?.length)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
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
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={\`fixed inset-y-0 left-0 \${sidebarOpen ? 'w-60 translate-x-0' : '-translate-x-full'} \${collapsed ? 'lg:w-16' : 'lg:w-60'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-40 transition-all duration-200 lg:translate-x-0\`}>
        <div className="h-14 flex items-center px-5 border-b border-gray-200 dark:border-gray-800">
          <span className={\`text-sm font-semibold text-gray-900 dark:text-white \${collapsed ? 'lg:hidden' : ''}\`}>{appName}</span>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          <a href="/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className={\`\${collapsed ? 'lg:hidden' : ''}\`}>Dashboard</span>
          </a>
          <a href="#users-section" onClick={(e) => { e.preventDefault(); setSidebarOpen(false); document.getElementById('users-section')?.scrollIntoView({ behavior: 'smooth' }) }} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <span className={\`\${collapsed ? 'lg:hidden' : ''}\`}>Users</span>
          </a>
        </nav>

        {/* Collapse toggle */}
        <div className="px-3 py-2 hidden lg:block">
          <button onClick={() => setCollapsed(!collapsed)} className="flex items-center justify-center w-full px-2.5 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <span className="text-xs font-mono">{collapsed ? '>>' : '<<'}</span>
          </button>
        </div>

        {/* Bottom links */}
        <div className="px-3 py-3 mt-auto border-t border-gray-200 dark:border-gray-800 space-y-0.5">
          <a href="https://github.com/mantiqjs/mantiq" target="_blank" rel="noopener" className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
            <span className={\`\${collapsed ? 'lg:hidden' : ''}\`}>Documentation</span>
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className={\`flex-1 \${collapsed ? 'lg:ml-16' : 'lg:ml-60'} transition-all duration-200\`}>
        {/* Top bar */}
        <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-6">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden mr-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-sm font-medium text-gray-900 dark:text-gray-200">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Toggle theme">
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            {/* Account dropdown */}
            <div className="relative">
              <button onClick={() => setAccountOpen(!accountOpen)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {currentUser?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:block">{currentUser?.name}</span>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{currentUser?.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{currentUser?.email}</div>
                    </div>
                    <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6 space-y-6 animate-fade-up">
          <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Welcome back, {currentUser?.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Here's what's happening with your application.</p>
          </div>

          <div id="users-section" className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-200">Users</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">{loading ? 'Loading...' : \`\${users.length} total\`}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-200">{u.name}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={\`text-[10px] px-2 py-0.5 rounded-full font-medium \${
                        u.role === 'admin' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                      }\`}>{u.role}</span>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400 dark:text-gray-600">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
`,
  }
}
