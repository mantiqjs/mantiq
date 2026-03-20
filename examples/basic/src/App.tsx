import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface User { id: number; name: string; email: string; role: string }
interface AppProps { appName?: string; currentUser?: User | null; currentPage?: string }

// ── API ───────────────────────────────────────────────────────────────────────

async function api<T = any>(url: string, opts: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } })
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  return { ok: res.ok, status: res.status, data }
}

function post(url: string, body: object) {
  return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>{children}</div>
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-400">{label}</label>
      <input {...props} className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
    </div>
  )
}

function Btn({ children, loading, className = '', ...props }: { children: React.ReactNode; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button disabled={loading} {...props}
      className={`disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm py-2.5 rounded-lg transition-colors ${className}`}>
      {children}
    </button>
  )
}

function Alert({ type, children }: { type: 'error' | 'success'; children: React.ReactNode }) {
  const styles = type === 'error'
    ? 'bg-red-500/10 border-red-500/30 text-red-400'
    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
  return <div className={`border rounded-lg px-3.5 py-2.5 text-sm ${styles}`}>{children}</div>
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
      role === 'admin' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-gray-800 text-gray-400 border border-gray-700'
    }`}>{role}</span>
  )
}

// ── Auth Layout (shared between login & register) ─────────────────────────────

function AuthLayout({ appName, children }: { appName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950 via-gray-950 to-gray-950 items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(99,102,241,0.08),transparent_60%)]" />
        <div className="relative space-y-6 max-w-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">{appName}</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight">
            The logical framework<br />for Bun.
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            Session auth, guards, encrypted cookies, CSRF protection — all wired up and ready to go.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {['Session Auth', 'CSRF', 'Encrypted Cookies', 'Guards'].map((t) => (
              <span key={t} className="text-xs text-indigo-300/70 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">{appName}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Login Page ────────────────────────────────────────────────────────────────

function LoginPage({ appName, onLogin, onGoRegister }: { appName: string; onLogin: (u: User) => void; onGoRegister: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { ok, data } = await post('/login', { email, password, remember })
      ok ? onLogin(data.user) : setError(data?.error ?? 'Login failed')
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  const fill = (e: string) => { setEmail(e); setPassword('password'); setError('') }

  return (
    <AuthLayout appName={appName}>
      <div>
        <h1 className="text-2xl font-bold text-white">Sign in</h1>
        <p className="text-sm text-gray-500 mt-1">Enter your credentials to continue.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" required />

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500/30" />
          <span className="text-sm text-gray-500">Remember me</span>
        </label>

        <Btn type="submit" loading={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
          {loading ? 'Signing in...' : 'Sign in'}
        </Btn>
      </form>

      <p className="text-sm text-gray-500 text-center">
        Don't have an account?{' '}
        <button onClick={onGoRegister} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Create one</button>
      </p>

      {/* Demo accounts */}
      <div className="border-t border-gray-800/50 pt-4">
        <p className="text-xs text-gray-600 mb-2">Quick fill — password is <code className="text-gray-500">password</code></p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { email: 'alice@example.com', name: 'Alice', role: 'admin' },
            { email: 'bob@example.com', name: 'Bob', role: 'user' },
            { email: 'carol@example.com', name: 'Carol', role: 'user' },
          ].map((u) => (
            <button key={u.email} type="button" onClick={() => fill(u.email)}
              className="text-center bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg px-2 py-2 transition-colors group">
              <div className="w-7 h-7 rounded-full bg-gray-800 group-hover:bg-indigo-600/30 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:text-indigo-300 mx-auto mb-1 transition-colors">
                {u.name[0]}
              </div>
              <p className="text-xs text-gray-400 group-hover:text-gray-200 font-medium">{u.name}</p>
              <p className="text-[10px] text-gray-600">{u.role}</p>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  )
}

// ── Register Page ─────────────────────────────────────────────────────────────

function RegisterPage({ appName, onRegister, onGoLogin }: { appName: string; onRegister: (u: User) => void; onGoLogin: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    if (password !== confirm) { setError('Passwords do not match.'); setLoading(false); return }
    try {
      const { ok, data } = await post('/register', { name, email, password, password_confirmation: confirm })
      ok ? onRegister(data.user) : setError(data?.error ?? 'Registration failed')
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  return (
    <AuthLayout appName={appName}>
      <div>
        <h1 className="text-2xl font-bold text-white">Create account</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the details to get started.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        <Input label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required autoFocus />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6} />
        <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" required minLength={6} />

        <Btn type="submit" loading={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
          {loading ? 'Creating account...' : 'Create account'}
        </Btn>
      </form>

      <p className="text-sm text-gray-500 text-center">
        Already have an account?{' '}
        <button onClick={onGoLogin} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Sign in</button>
      </p>
    </AuthLayout>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

interface Pagination { total: number; page: number; per_page: number; last_page: number; from: number; to: number; has_more: boolean }

function Dashboard({ appName, user, onLogout, onValidation, onCli, onStorage, onChat }: { appName: string; user: User; onLogout: () => void; onValidation: () => void; onCli: () => void; onStorage: () => void; onChat: () => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [pag, setPag] = useState<Pagination>({ total: 0, page: 1, per_page: 20, last_page: 1, from: 0, to: 0, has_more: false })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [pingMs, setPingMs] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'user' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // SSE streaming state
  const [streaming, setStreaming] = useState(false)
  const [streamUsers, setStreamUsers] = useState<User[]>([])
  const [streamHighlight, setStreamHighlight] = useState<number | null>(null)
  const [streamCycle, setStreamCycle] = useState(0)
  const [streamSource, setStreamSource] = useState<EventSource | null>(null)
  const streamEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamUsers, streamHighlight])

  const startStream = useCallback(() => {
    if (streamSource) { streamSource.close() }
    setStreamUsers([])
    setStreamCycle(0)
    const es = new EventSource('/api/users/stream')
    es.addEventListener('total', (e) => {
      const { count } = JSON.parse(e.data)
      setPag((p) => ({ ...p, total: count }))
    })
    es.addEventListener('user', (e) => {
      const u = JSON.parse(e.data)
      setStreamHighlight(u.id)
      setStreamUsers((prev) => {
        const exists = prev.find((x) => x.id === u.id)
        if (exists) return prev.map((x) => x.id === u.id ? u : x)
        return [...prev, u]
      })
      setTimeout(() => setStreamHighlight(null), 400)
    })
    es.addEventListener('cycle', () => {
      setStreamCycle((c) => c + 1)
    })
    es.onerror = () => { /* reconnects automatically */ }
    setStreamSource(es)
    setStreaming(true)
  }, [streamSource])

  const stopStream = useCallback(() => {
    streamSource?.close()
    setStreamSource(null)
    setStreaming(false)
  }, [streamSource])

  // Clean up SSE on unmount
  useEffect(() => () => { streamSource?.close() }, [streamSource])

  const fetchUsers = useCallback(async (page = 1, q = search) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), per_page: '20' })
    if (q) params.set('search', q)
    const { ok, data } = await api(`/api/users?${params}`)
    if (ok) {
      setUsers(data.data)
      setPag({ total: data.total, page: data.page, per_page: data.per_page, last_page: data.last_page, from: data.from, to: data.to, has_more: data.has_more })
    }
    setLoading(false)
  }, [search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  useEffect(() => {
    const t0 = performance.now()
    api('/api/ping').then(() => setPingMs(Math.round(performance.now() - t0)))
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    fetchUsers(1, searchInput)
  }

  const goToPage = (p: number) => fetchUsers(p)

  const handleLogout = async () => { setLoggingOut(true); await post('/logout', {}); onLogout() }

  const resetForm = () => { setForm({ name: '', email: '', role: 'user' }); setEditingId(null); setFormError(''); setShowForm(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setFormSuccess(''); setFormLoading(true)
    try {
      const url = editingId ? `/api/users/${editingId}` : '/api/users'
      const { ok, data } = await api(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (ok) { setFormSuccess(editingId ? 'Updated' : 'Created'); resetForm(); await fetchUsers(pag.page); setTimeout(() => setFormSuccess(''), 2000) }
      else setFormError(data?.error?.message ?? data?.error ?? 'Failed')
    } finally { setFormLoading(false) }
  }

  const startEdit = (u: User) => { setEditingId(u.id); setForm({ name: u.name, email: u.email, role: u.role }); setFormError(''); setShowForm(true) }

  const handleDelete = async (id: number) => {
    await api(`/api/users/${id}`, { method: 'DELETE' })
    await fetchUsers(pag.page)
    if (editingId === id) resetForm()
  }

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">{appName}</span>
            <span className="text-[10px] text-gray-600 hidden sm:inline ml-1">Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onValidation}
              className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-lg px-2.5 py-1.5 transition-colors">
              Validation
            </button>
            <button onClick={onCli}
              className="text-xs text-amber-400 hover:text-amber-300 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 rounded-lg px-2.5 py-1.5 transition-colors">
              CLI
            </button>
            <button onClick={onStorage}
              className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 transition-colors">
              Storage
            </button>
            <button onClick={onChat}
              className="text-xs text-rose-400 hover:text-rose-300 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 rounded-lg px-2.5 py-1.5 transition-colors">
              Chat
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-bold text-white">{user.name[0]}</div>
              <div className="hidden sm:block leading-none">
                <p className="text-xs font-medium text-gray-300">{user.name}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{user.email}</p>
              </div>
              {user.role === 'admin' && <RoleBadge role="admin" />}
            </div>
            <button onClick={handleLogout} disabled={loggingOut}
              className="text-xs text-gray-500 hover:text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-2.5 py-1.5 transition-colors">
              {loggingOut ? '...' : 'Sign out'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold text-white">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's an overview of your application.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total Users" value={fmt(pag.total)} color="indigo" />
          <Stat label="Page" value={`${pag.page} / ${fmt(pag.last_page)}`} color="purple" />
          <Stat label="Showing" value={pag.total > 0 ? `${fmt(pag.from)}-${fmt(pag.to)}` : '0'} color="sky" />
          <Stat label="API Latency" value={pingMs !== null ? `${pingMs}ms` : '...'} color="emerald" />
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Session card */}
          <Card className="lg:col-span-2 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">Your Session</h2>
            <div className="space-y-3 text-xs">
              <Row label="Signed in as" value={user.email} />
              <Row label="Name" value={user.name} />
              <Row label="Role" value={<RoleBadge role={user.role} />} />
              <Row label="User ID" value={`#${user.id}`} />
              <Row label="Guard" value="session (web)" />
            </div>
          </Card>

          {/* Users */}
          <Card className="lg:col-span-3 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300">Users <span className="text-gray-600 font-normal">({fmt(pag.total)})</span></h2>
                <button onClick={() => { resetForm(); setShowForm(true) }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add</button>
              </div>
              {/* Search */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <input type="text" placeholder="Search by name or email..." value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
                <Btn type="submit" className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 text-xs border border-gray-700">
                  Search
                </Btn>
                {search && (
                  <button type="button" onClick={() => { setSearchInput(''); setSearch(''); fetchUsers(1, '') }}
                    className="text-[10px] text-gray-500 hover:text-gray-300 px-2">Clear</button>
                )}
              </form>
            </div>

            {formSuccess && <div className="px-5 py-2"><Alert type="success">{formSuccess}</Alert></div>}

            {showForm && (
              <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-gray-800 space-y-3 bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">{editingId ? `Edit #${editingId}` : 'New user'}</span>
                  <button type="button" onClick={resetForm} className="text-[10px] text-gray-600 hover:text-gray-400">Cancel</button>
                </div>
                {formError && <Alert type="error">{formError}</Alert>}
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-indigo-500">
                    <option value="user">user</option><option value="admin">admin</option>
                  </select>
                </div>
                <Btn type="submit" loading={formLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 text-xs">
                  {formLoading ? '...' : editingId ? 'Update' : 'Create'}
                </Btn>
              </form>
            )}

            <div className={`divide-y divide-gray-800/50 ${loading ? 'opacity-50' : ''} transition-opacity`}>
              {users.map((u) => (
                <div key={u.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-gray-800/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      u.id === user.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-500'
                    }`}>{u.name[0]}</div>
                    <div>
                      <p className="text-sm font-medium text-gray-200 leading-tight">
                        {u.name}{u.id === user.id && <span className="text-[10px] text-indigo-400 ml-1.5">you</span>}
                      </p>
                      <p className="text-[11px] text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-600 font-mono">#{u.id}</span>
                    <RoleBadge role={u.role} />
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(u)} className="text-[11px] text-gray-600 hover:text-blue-400 transition-colors">Edit</button>
                      <button onClick={() => handleDelete(u.id)} className="text-[11px] text-gray-600 hover:text-red-400 transition-colors">Del</button>
                    </div>
                  </div>
                </div>
              ))}
              {users.length === 0 && !loading && <div className="px-5 py-10 text-center text-gray-600 text-sm">{search ? 'No matches.' : 'No users.'}</div>}
            </div>

            {/* Pagination */}
            {pag.last_page > 1 && (
              <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
                <p className="text-[11px] text-gray-500">
                  {fmt(pag.from)}-{fmt(pag.to)} of {fmt(pag.total)}
                </p>
                <div className="flex items-center gap-1">
                  <PagBtn label="First" disabled={pag.page === 1} onClick={() => goToPage(1)} />
                  <PagBtn label="Prev" disabled={pag.page === 1} onClick={() => goToPage(pag.page - 1)} />
                  {pageRange(pag.page, pag.last_page).map((p) => (
                    <button key={p} onClick={() => goToPage(p)}
                      className={`min-w-[28px] h-7 text-[11px] rounded-md transition-colors ${
                        p === pag.page
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'
                      }`}>{fmt(p)}</button>
                  ))}
                  <PagBtn label="Next" disabled={!pag.has_more} onClick={() => goToPage(pag.page + 1)} />
                  <PagBtn label="Last" disabled={pag.page === pag.last_page} onClick={() => goToPage(pag.last_page)} />
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* SSE Live Stream */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
                <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h2 className="text-sm font-semibold text-gray-300">SSE Live Stream</h2>
              {streaming && (
                <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Streaming {streamCycle > 0 && `· cycle ${streamCycle + 1}`}
                </span>
              )}
              {!streaming && streamUsers.length > 0 && (
                <span className="text-[10px] text-gray-600">Paused · {streamUsers.length} received</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {streaming && (
                <button onClick={() => { setStreamUsers([]); setStreamCycle(0) }}
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">Clear</button>
              )}
              <button onClick={streaming ? stopStream : startStream}
                className={`text-[11px] px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  streaming
                    ? 'text-red-400 bg-red-600/10 border-red-500/20 hover:bg-red-600/20'
                    : 'text-cyan-400 bg-cyan-600/10 border-cyan-500/20 hover:bg-cyan-600/20'
                }`}>
                {streaming ? 'Stop' : 'Start Stream'}
              </button>
            </div>
          </div>

          {!streaming && streamUsers.length === 0 && (
            <div className="px-5 py-10 text-center space-y-2">
              <p className="text-sm text-gray-500">Server-Sent Events demo</p>
              <p className="text-xs text-gray-600 max-w-md mx-auto">
                Click <strong className="text-cyan-400">Start Stream</strong> to open an SSE connection. Users are streamed from the database in paginated chunks of 20, one every 500ms, looping infinitely.
              </p>
            </div>
          )}

          {(streaming || streamUsers.length > 0) && (
            <div className="divide-y divide-gray-800/50 max-h-80 overflow-y-auto">
              {streamUsers.map((u) => (
                <div key={u.id} className={`px-5 py-2 flex items-center justify-between transition-all duration-300 ${
                  streamHighlight === u.id ? 'bg-cyan-500/10' : ''
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors duration-300 ${
                      streamHighlight === u.id ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-500'
                    }`}>{u.name[0]}</div>
                    <div>
                      <p className="text-xs font-medium text-gray-200 leading-tight">{u.name}</p>
                      <p className="text-[10px] text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 font-mono">#{u.id}</span>
                    <RoleBadge role={u.role} />
                  </div>
                </div>
              ))}
              <div ref={streamEndRef} />
            </div>
          )}

          <div className="px-5 py-2.5 border-t border-gray-800/50 flex items-center justify-between">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-600">
              <span>EventSource API</span>
              <span>Chunked (20/page)</span>
              <span>Auto-reconnect</span>
              <span>text/event-stream</span>
            </div>
            <span className="text-[10px] text-gray-600">{streamUsers.length} users received</span>
          </div>
        </Card>

        {/* Footer */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-gray-600">
            <span>Bun</span><span>@mantiq/core</span><span>@mantiq/auth</span><span>@mantiq/database</span><span>@mantiq/realtime</span><span>React</span><span>Tailwind</span>
          </div>
        </div>
      </main>
    </div>
  )
}

function PagBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="h-7 px-2 text-[11px] text-gray-500 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-md transition-colors">
      {label}
    </button>
  )
}

function pageRange(current: number, last: number): number[] {
  const delta = 2
  const pages: number[] = []
  const start = Math.max(1, current - delta)
  const end = Math.min(last, current + delta)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  const bg: Record<string, string> = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  }
  return (
    <Card className="p-4">
      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-2.5 text-sm font-bold ${bg[color]}`}>
        {typeof value === 'number' ? value : '#'}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-gray-500">{label}</span><span className="text-gray-300 font-medium">{value}</span></div>
}

// ── Validation Playground ────────────────────────────────────────────────────

interface RuleDemo {
  rule: string
  description: string
  field: string
  validValue: string
  invalidValue: string
  extraData?: Record<string, any>
  extraRules?: Record<string, string>
}

interface RuleSection {
  title: string
  description: string
  color: string
  rules: RuleDemo[]
}

const SECTIONS: RuleSection[] = [
  {
    title: 'Presence Rules',
    description: 'Control whether a field must be present and non-empty.',
    color: 'indigo',
    rules: [
      { rule: 'required', description: 'Field must be present and non-empty', field: 'name', validValue: 'Alice', invalidValue: '' },
      { rule: 'nullable', description: 'Allow null — skip remaining rules if null', field: 'bio', validValue: '', invalidValue: '' },
      { rule: 'present', description: 'Key must exist in the data (even if empty)', field: 'status', validValue: '', invalidValue: '' },
      { rule: 'filled', description: 'If present, must not be empty', field: 'nickname', validValue: 'ali', invalidValue: '' },
    ],
  },
  {
    title: 'Conditional Presence',
    description: 'Require a field based on the value of another field.',
    color: 'violet',
    rules: [
      { rule: 'required_if:role,admin', description: 'Required when role is admin', field: 'permissions', validValue: 'all', invalidValue: '', extraData: { role: 'admin' } },
      { rule: 'required_unless:role,guest', description: 'Required unless role is guest', field: 'email', validValue: 'a@b.com', invalidValue: '', extraData: { role: 'user' } },
      { rule: 'required_with:first_name', description: 'Required when first_name is present', field: 'last_name', validValue: 'Doe', invalidValue: '', extraData: { first_name: 'John' } },
      { rule: 'required_without:email', description: 'Required when email is absent', field: 'phone', validValue: '+1234567890', invalidValue: '' },
    ],
  },
  {
    title: 'Type Rules',
    description: 'Ensure the value is of a specific type.',
    color: 'sky',
    rules: [
      { rule: 'string', description: 'Must be a string', field: 'name', validValue: 'Alice', invalidValue: '123' },
      { rule: 'numeric', description: 'Must be numeric (int or float string)', field: 'price', validValue: '29.99', invalidValue: 'abc' },
      { rule: 'integer', description: 'Must be an integer', field: 'count', validValue: '42', invalidValue: '3.14' },
      { rule: 'boolean', description: 'Must be true/false/0/1', field: 'active', validValue: 'true', invalidValue: 'yes' },
    ],
  },
  {
    title: 'Size Rules',
    description: 'Validate the size of strings, numbers, or arrays.',
    color: 'emerald',
    rules: [
      { rule: 'min:3', description: 'Minimum 3 characters', field: 'name', validValue: 'Alice', invalidValue: 'Al' },
      { rule: 'max:10', description: 'Maximum 10 characters', field: 'code', validValue: 'ABC', invalidValue: 'This is way too long' },
      { rule: 'between:5,10', description: 'Between 5 and 10 characters', field: 'username', validValue: 'alice1', invalidValue: 'ab' },
      { rule: 'size:5', description: 'Exactly 5 characters', field: 'zip', validValue: '90210', invalidValue: '1234' },
    ],
  },
  {
    title: 'String Format Rules',
    description: 'Validate string patterns and formats.',
    color: 'amber',
    rules: [
      { rule: 'email', description: 'Valid email address', field: 'email', validValue: 'alice@example.com', invalidValue: 'not-an-email' },
      { rule: 'url', description: 'Valid URL', field: 'website', validValue: 'https://example.com', invalidValue: 'not-a-url' },
      { rule: 'uuid', description: 'Valid UUID v4', field: 'id', validValue: '550e8400-e29b-41d4-a716-446655440000', invalidValue: 'not-a-uuid' },
      { rule: 'alpha', description: 'Only letters', field: 'name', validValue: 'Alice', invalidValue: 'Alice123' },
      { rule: 'alpha_num', description: 'Letters and numbers', field: 'code', validValue: 'ABC123', invalidValue: 'ABC-123!' },
      { rule: 'alpha_dash', description: 'Letters, numbers, dashes, underscores', field: 'slug', validValue: 'my-post_1', invalidValue: 'has spaces!' },
      { rule: 'starts_with:http,https', description: 'Must start with http or https', field: 'url', validValue: 'https://example.com', invalidValue: 'ftp://example.com' },
      { rule: 'ends_with:.jpg,.png', description: 'Must end with .jpg or .png', field: 'file', validValue: 'photo.jpg', invalidValue: 'document.pdf' },
      { rule: 'lowercase', description: 'Must be lowercase', field: 'tag', validValue: 'javascript', invalidValue: 'JavaScript' },
      { rule: 'uppercase', description: 'Must be uppercase', field: 'code', validValue: 'USD', invalidValue: 'usd' },
      { rule: 'regex:/^[A-Z]{3}-\\d{3}$/', description: 'Match regex pattern', field: 'code', validValue: 'ABC-123', invalidValue: 'abc123' },
    ],
  },
  {
    title: 'Comparison Rules',
    description: 'Compare a field against another field in the data.',
    color: 'rose',
    rules: [
      { rule: 'confirmed', description: 'Must have a matching _confirmation field', field: 'password', validValue: 'secret123', invalidValue: 'secret123', extraData: { password_confirmation: 'secret123' } },
      { rule: 'same:other', description: 'Must match another field', field: 'confirm', validValue: 'yes', invalidValue: 'no', extraData: { other: 'yes' } },
      { rule: 'different:old_email', description: 'Must differ from another field', field: 'email', validValue: 'new@example.com', invalidValue: 'same@example.com', extraData: { old_email: 'same@example.com' } },
      { rule: 'gt:min_val', description: 'Greater than another field', field: 'price', validValue: '100', invalidValue: '5', extraData: { min_val: 50 } },
      { rule: 'gte:min_val', description: 'Greater than or equal', field: 'score', validValue: '50', invalidValue: '49', extraData: { min_val: 50 } },
      { rule: 'lt:max_val', description: 'Less than another field', field: 'discount', validValue: '10', invalidValue: '200', extraData: { max_val: 100 } },
      { rule: 'lte:max_val', description: 'Less than or equal', field: 'count', validValue: '100', invalidValue: '101', extraData: { max_val: 100 } },
    ],
  },
  {
    title: 'Inclusion Rules',
    description: 'Check if a value is in (or not in) a set of allowed values.',
    color: 'purple',
    rules: [
      { rule: 'in:admin,user,editor', description: 'Must be one of the listed values', field: 'role', validValue: 'admin', invalidValue: 'superadmin' },
      { rule: 'not_in:banned,suspended', description: 'Must not be one of the listed values', field: 'status', validValue: 'active', invalidValue: 'banned' },
    ],
  },
  {
    title: 'Date Rules',
    description: 'Validate date values and date comparisons.',
    color: 'teal',
    rules: [
      { rule: 'date', description: 'Must be a valid date', field: 'birthday', validValue: '2000-01-15', invalidValue: 'not-a-date' },
      { rule: 'before:2025-01-01', description: 'Must be before the given date', field: 'start', validValue: '2024-06-01', invalidValue: '2025-06-01' },
      { rule: 'after:2024-01-01', description: 'Must be after the given date', field: 'end', validValue: '2024-06-01', invalidValue: '2023-12-31' },
    ],
  },
  {
    title: 'Special Rules',
    description: 'IP addresses, JSON, and more.',
    color: 'orange',
    rules: [
      { rule: 'ip', description: 'Must be a valid IPv4 or IPv6 address', field: 'ip', validValue: '192.168.1.1', invalidValue: '999.999.999.999' },
      { rule: 'json', description: 'Must be a valid JSON string', field: 'config', validValue: '{"key":"value"}', invalidValue: '{broken json}' },
    ],
  },
  {
    title: 'Database Rules',
    description: 'Check existence/uniqueness in a database table. Requires a PresenceVerifier.',
    color: 'cyan',
    rules: [
      { rule: 'exists:table,column', description: 'Value must exist in the given table', field: 'role_id', validValue: '1', invalidValue: '' },
      { rule: 'unique:table,column', description: 'Value must be unique in the given table', field: 'email', validValue: 'new@example.com', invalidValue: '' },
    ],
  },
]

const SEC_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  indigo:  { border: 'border-indigo-500/20', bg: 'bg-indigo-500/5', text: 'text-indigo-400', badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' },
  violet:  { border: 'border-violet-500/20', bg: 'bg-violet-500/5', text: 'text-violet-400', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/25' },
  sky:     { border: 'border-sky-500/20', bg: 'bg-sky-500/5', text: 'text-sky-400', badge: 'bg-sky-500/15 text-sky-300 border-sky-500/25' },
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  amber:   { border: 'border-amber-500/20', bg: 'bg-amber-500/5', text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  rose:    { border: 'border-rose-500/20', bg: 'bg-rose-500/5', text: 'text-rose-400', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25' },
  purple:  { border: 'border-purple-500/20', bg: 'bg-purple-500/5', text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
  teal:    { border: 'border-teal-500/20', bg: 'bg-teal-500/5', text: 'text-teal-400', badge: 'bg-teal-500/15 text-teal-300 border-teal-500/25' },
  orange:  { border: 'border-orange-500/20', bg: 'bg-orange-500/5', text: 'text-orange-400', badge: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
  cyan:    { border: 'border-cyan-500/20', bg: 'bg-cyan-500/5', text: 'text-cyan-400', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25' },
}

function RuleCard({ demo, sectionColor }: { demo: RuleDemo; sectionColor: string }) {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<{ ok: boolean; errors?: string[] } | null>(null)
  const [testing, setTesting] = useState(false)
  const isDbRule = demo.rule.startsWith('exists:table') || demo.rule.startsWith('unique:table')

  const test = async (testValue: string) => {
    if (isDbRule) {
      setResult({ ok: false, errors: ['Database rules require a PresenceVerifier — cannot test in playground (no DB connection).'] })
      return
    }
    setTesting(true)
    const data: Record<string, any> = { ...demo.extraData, [demo.field]: testValue || undefined }
    const rules: Record<string, string> = { ...demo.extraRules, [demo.field]: `required|${demo.rule}` }
    try {
      const { ok, data: res } = await post('/api/validate/test', { data, rules })
      if (ok) setResult({ ok: true })
      else setResult({ ok: false, errors: res.errors?.[demo.field] ?? ['Validation failed'] })
    } catch { setResult({ ok: false, errors: ['Network error'] }) }
    finally { setTesting(false) }
  }

  const c = SEC_COLORS[sectionColor]!

  return (
    <div className={`bg-gray-900 rounded-xl border ${result === null ? 'border-gray-800' : result.ok ? 'border-emerald-500/30' : 'border-red-500/30'} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <code className={`text-sm font-semibold ${c.text} font-mono`}>{demo.rule.split(':')[0]}</code>
          <p className="text-xs text-gray-500 mt-0.5">{demo.description}</p>
        </div>
        <code className={`text-[10px] border rounded px-1.5 py-0.5 shrink-0 ${c.badge}`}>{demo.rule}</code>
      </div>

      {demo.extraData && (
        <div className="text-[10px] text-gray-600 bg-gray-800/50 rounded-md px-2.5 py-1.5 font-mono">
          context: {JSON.stringify(demo.extraData)}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setResult(null) }}
          placeholder={`e.g. ${demo.validValue || '(empty)'}`}
          className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
        />
        <button onClick={() => test(value)} disabled={testing}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-3 py-2 transition-colors disabled:opacity-50 shrink-0">
          {testing ? '...' : 'Test'}
        </button>
      </div>

      {/* Quick fill buttons */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-600">Try:</span>
        {demo.validValue && (
          <button onClick={() => { setValue(demo.validValue); setResult(null); test(demo.validValue) }}
            className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-2 py-0.5 hover:bg-emerald-500/20 transition-colors">
            {demo.validValue.length > 30 ? demo.validValue.slice(0, 27) + '...' : demo.validValue}
          </button>
        )}
        <button onClick={() => { setValue(demo.invalidValue); setResult(null); test(demo.invalidValue) }}
          className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-2 py-0.5 hover:bg-red-500/20 transition-colors">
          {demo.invalidValue || '(empty)'}
        </button>
      </div>

      {result && (
        <div className={`rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
          {result.ok ? 'Passed' : result.errors?.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}
    </div>
  )
}

function ValidationPlayground({ appName, onBack }: { appName: string; onBack: () => void }) {
  const totalRules = SECTIONS.reduce((n, s) => n + s.rules.length, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">{appName}</span>
            <span className="text-[10px] text-gray-600 ml-1">Validation Playground</span>
          </div>
          <button onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-2.5 py-1.5 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">@mantiq/validation</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            Interactive showcase of all {totalRules} validation rules. Each card demonstrates one rule — click the
            pre-filled values to see it pass or fail, or type your own value and hit Test.
          </p>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <a key={s.title} href={`#${s.title.toLowerCase().replace(/\s+/g, '-')}`}
                className={`text-[11px] border rounded-full px-3 py-1 transition-colors hover:opacity-80 ${SEC_COLORS[s.color]!.badge}`}>
                {s.title} ({s.rules.length})
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map((section) => {
          const c = SEC_COLORS[section.color]!
          return (
            <section key={section.title} id={section.title.toLowerCase().replace(/\s+/g, '-')} className="space-y-4">
              <div className={`rounded-xl border ${c.border} ${c.bg} px-5 py-4`}>
                <h2 className={`text-lg font-bold ${c.text}`}>{section.title}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {section.rules.map((demo) => (
                  <RuleCard key={`${section.title}-${demo.rule}`} demo={demo} sectionColor={section.color} />
                ))}
              </div>
            </section>
          )
        })}

        {/* Footer */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 px-5 py-4 space-y-2">
          <p className="text-xs text-gray-400">
            <span className="text-gray-300 font-medium">@mantiq/validation</span> — Laravel-inspired validation engine for Bun.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-gray-600">
            <span>Validator</span><span>FormRequest</span><span>validate() helper</span><span>{totalRules} built-in rules</span><span>Custom Rule objects</span><span>PresenceVerifier (DB)</span>
          </div>
        </div>
      </main>
    </div>
  )
}

// ── CLI Docs ─────────────────────────────────────────────────────────────────

interface CmdDef {
  cmd: string
  description: string
  flags?: { flag: string; desc: string }[]
  example?: string
  output?: string
}

const CLI_SECTIONS: { title: string; description: string; color: string; commands: CmdDef[] }[] = [
  {
    title: 'Generators',
    description: 'Scaffold models, controllers, migrations, and more with a single command.',
    color: 'indigo',
    commands: [
      {
        cmd: 'make:model',
        description: 'Create a new Eloquent-style model class.',
        flags: [
          { flag: '-m, --migration', desc: 'Also create a migration file' },
          { flag: '-f, --factory', desc: 'Also create a model factory' },
          { flag: '-s, --seed', desc: 'Also create a seeder' },
        ],
        example: 'bun mantiq make:model Product -m -f -s',
        output: `  DONE  Created app/Models/Product.ts
  DONE  Created database/migrations/20260319_create_products_table.ts
  DONE  Created database/factories/ProductFactory.ts
  DONE  Created database/seeders/ProductSeeder.ts`,
      },
      {
        cmd: 'make:controller',
        description: 'Create a new HTTP controller.',
        flags: [
          { flag: '--resource, -r', desc: 'Generate index, show, store, update, destroy methods' },
        ],
        example: 'bun mantiq make:controller User --resource',
        output: '  DONE  Created app/Http/Controllers/UserController.ts',
      },
      {
        cmd: 'make:migration',
        description: 'Create a new database migration file with a timestamp prefix.',
        flags: [
          { flag: '--create=<table>', desc: 'Generate a create table stub' },
          { flag: '--table=<table>', desc: 'Generate an alter table stub' },
        ],
        example: 'bun mantiq make:migration create_orders_table --create=orders',
        output: '  DONE  Created database/migrations/20260319120000_create_orders_table.ts',
      },
      {
        cmd: 'make:seeder',
        description: 'Create a new database seeder class.',
        example: 'bun mantiq make:seeder UserSeeder',
        output: '  DONE  Created database/seeders/UserSeeder.ts',
      },
      {
        cmd: 'make:factory',
        description: 'Create a new model factory for generating test data.',
        example: 'bun mantiq make:factory User',
        output: '  DONE  Created database/factories/UserFactory.ts',
      },
      {
        cmd: 'make:middleware',
        description: 'Create a new HTTP middleware class.',
        example: 'bun mantiq make:middleware RateLimit',
        output: '  DONE  Created app/Http/Middleware/RateLimitMiddleware.ts',
      },
      {
        cmd: 'make:request',
        description: 'Create a new form request validation class.',
        example: 'bun mantiq make:request StoreProduct',
        output: '  DONE  Created app/Http/Requests/StoreProductRequest.ts',
      },
    ],
  },
  {
    title: 'Database',
    description: 'Run and manage database migrations and seeders.',
    color: 'emerald',
    commands: [
      {
        cmd: 'migrate',
        description: 'Run all pending database migrations.',
        example: 'bun mantiq migrate',
        output: `  INFO  Running migrations...
  DONE  20260319_create_users_table ............ migrated
  DONE  20260319_create_products_table ......... migrated`,
      },
      {
        cmd: 'migrate:rollback',
        description: 'Rollback the last batch of migrations.',
        example: 'bun mantiq migrate:rollback',
        output: '  INFO  Rolling back last batch...',
      },
      {
        cmd: 'migrate:reset',
        description: 'Rollback all migrations. Requires --force in production.',
        flags: [
          { flag: '--force', desc: 'Force the operation in production' },
        ],
        example: 'bun mantiq migrate:reset --force',
      },
      {
        cmd: 'migrate:fresh',
        description: 'Drop all tables and re-run all migrations from scratch.',
        flags: [
          { flag: '--seed', desc: 'Run seeders after migrating' },
        ],
        example: 'bun mantiq migrate:fresh --seed',
      },
      {
        cmd: 'migrate:status',
        description: 'Show the current status of each migration.',
        example: 'bun mantiq migrate:status',
        output: `  Migration Status

  ----------+---------------------------------------+-------
   Status   | Migration                             | Batch
  ----------+---------------------------------------+-------
   Ran      | 20260319_create_users_table           | 1
   Ran      | 20260319_create_products_table        | 1
   Pending  | 20260319_create_orders_table          |
  ----------+---------------------------------------+-------`,
      },
      {
        cmd: 'seed',
        description: 'Run database seeders. Defaults to DatabaseSeeder.',
        example: 'bun mantiq seed UserSeeder',
        output: `  INFO  Seeding: UserSeeder...
  DONE  UserSeeder completed.`,
      },
    ],
  },
  {
    title: 'Utility',
    description: 'Development server, route inspection, and interactive REPL.',
    color: 'amber',
    commands: [
      {
        cmd: 'serve',
        description: 'Start the development server by bootstrapping the app entry point.',
        flags: [
          { flag: '--port=<number>', desc: 'Override the server port (default: 3000)' },
          { flag: '--host=<string>', desc: 'Override the server host (default: 0.0.0.0)' },
        ],
        example: 'bun mantiq serve --port=8080',
        output: `  Server running on http://localhost:8080`,
      },
      {
        cmd: 'route:list',
        description: 'List all registered routes with method, path, name, and middleware.',
        flags: [
          { flag: '--method=<METHOD>', desc: 'Filter by HTTP method' },
          { flag: '--path=<prefix>', desc: 'Filter by path prefix' },
        ],
        example: 'bun mantiq route:list --method=GET',
        output: `  Registered Routes

  --------+---------------------+------+-----------
   Method | Path                | Name | Middleware
  --------+---------------------+------+-----------
   GET    | /                   |      |
   GET    | /validation         |      |
   GET    | /cli                |      |
   GET    | /api/users          |      | auth
  --------+---------------------+------+-----------

  Showing 4 routes`,
      },
      {
        cmd: 'tinker',
        description: 'Interactive REPL with your app context. Auto-loads models, services, and database connection.',
        example: 'bun mantiq tinker',
        output: `  MantiqJS Tinker
  Available in scope:
    app, db, connection, router, User, Product

  > await User.all()
  [ { id: 1, name: 'Admin', email: 'admin@example.com' } ]
  > User.table
  'users'`,
      },
      {
        cmd: 'help',
        description: 'Show all available commands grouped by category.',
        example: 'bun mantiq help',
      },
    ],
  },
]

const CLI_SEC_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; accent: string }> = {
  indigo:  { bg: 'bg-indigo-500/5',  border: 'border-indigo-500/20', text: 'text-indigo-400',  badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',  accent: 'text-indigo-400' },
  emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', accent: 'text-emerald-400' },
  amber:   { bg: 'bg-amber-500/5',   border: 'border-amber-500/20',  text: 'text-amber-400',   badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',     accent: 'text-amber-400' },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy} title="Copy to clipboard"
      className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded px-1.5 py-0.5 transition-all shrink-0">
      {copied ? (
        <><svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-emerald-400">Copied</span></>
      ) : (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} /><path strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg><span>Copy</span></>
      )}
    </button>
  )
}

function CommandCard({ cmd, sectionColor }: { cmd: CmdDef; sectionColor: string }) {
  const c = CLI_SEC_COLORS[sectionColor]!
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <code className={`text-sm font-bold ${c.accent}`}>{cmd.cmd}</code>
        </div>
        <p className="text-sm text-gray-400">{cmd.description}</p>

        {/* Flags */}
        {cmd.flags && cmd.flags.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Options</p>
            {cmd.flags.map((f) => (
              <div key={f.flag} className="flex items-start gap-3 text-xs">
                <code className="text-gray-300 bg-gray-800/80 rounded px-1.5 py-0.5 shrink-0 font-mono">{f.flag}</code>
                <span className="text-gray-500">{f.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Example */}
      {cmd.example && (
        <div className="border-t border-gray-800/80 bg-gray-950/50 px-5 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium shrink-0">Example</span>
              <code className="text-xs text-gray-300 font-mono truncate">{cmd.example}</code>
            </div>
            <CopyButton text={cmd.example} />
          </div>

          {/* Output preview */}
          {cmd.output && (
            <pre className="text-[11px] text-gray-500 font-mono leading-relaxed whitespace-pre overflow-x-auto">{cmd.output}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function CLIDocs({ appName, onBack }: { appName: string; onBack: () => void }) {
  const totalCommands = CLI_SECTIONS.reduce((n, s) => n + s.commands.length, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">{appName}</span>
            <span className="text-[10px] text-gray-600 ml-1">CLI Reference</span>
          </div>
          <button onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-2.5 py-1.5 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">@mantiq/cli</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            {totalCommands} commands for scaffolding code, managing database migrations, and running your development server.
            Every command is available via <code className="text-gray-300 bg-gray-800/80 rounded px-1.5 py-0.5 text-xs">bun mantiq &lt;command&gt;</code>
          </p>

          {/* Quick start */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Quick Start</p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-sm text-gray-300 font-mono">bun mantiq help</code>
              <CopyButton text="bun mantiq help" />
            </div>
          </div>

          {/* Section nav */}
          <div className="flex flex-wrap gap-2">
            {CLI_SECTIONS.map((s) => (
              <a key={s.title} href={`#${s.title.toLowerCase()}`}
                className={`text-[11px] border rounded-full px-3 py-1 transition-colors hover:opacity-80 ${CLI_SEC_COLORS[s.color]!.badge}`}>
                {s.title} ({s.commands.length})
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        {CLI_SECTIONS.map((section) => {
          const c = CLI_SEC_COLORS[section.color]!
          return (
            <section key={section.title} id={section.title.toLowerCase()} className="space-y-4">
              <div className={`rounded-xl border ${c.border} ${c.bg} px-5 py-4`}>
                <h2 className={`text-lg font-bold ${c.text}`}>{section.title}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {section.commands.map((cmd) => (
                  <CommandCard key={cmd.cmd} cmd={cmd} sectionColor={section.color} />
                ))}
              </div>
            </section>
          )
        })}

        {/* Footer */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 px-5 py-4 space-y-2">
          <p className="text-xs text-gray-400">
            <span className="text-gray-300 font-medium">@mantiq/cli</span> — Laravel-inspired CLI toolkit for Bun.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-gray-600">
            <span>Kernel</span><span>Command</span><span>IO</span><span>Parser</span><span>GeneratorCommand</span><span>{totalCommands} built-in commands</span>
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Storage Playground ───────────────────────────────────────────────────────

interface FileEntry { path: string; size: number; lastModified: number }

function StoragePlayground({ appName, onBack }: { appName: string; onBack: () => void }) {
  const [disk, setDisk] = useState<'local' | 'public'>('local')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [dirs, setDirs] = useState<string[]>([])
  const [currentDir, setCurrentDir] = useState('')
  const [loading, setLoading] = useState(false)

  // Write form
  const [writePath, setWritePath] = useState('')
  const [writeContents, setWriteContents] = useState('')
  const [writeStatus, setWriteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Read viewer
  const [readPath, setReadPath] = useState('')
  const [readContents, setReadContents] = useState<string | null>(null)
  const [readError, setReadError] = useState('')

  // Info viewer
  const [infoPath, setInfoPath] = useState('')
  const [fileInfo, setFileInfo] = useState<any>(null)

  const fetchFiles = useCallback(async (dir = currentDir) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ disk })
      if (dir) params.set('directory', dir)
      const res = await fetch(`/api/storage/list?${params}`)
      const data = await res.json()
      if (res.ok) {
        setFiles(data.files ?? [])
        setDirs(data.directories ?? [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [disk, currentDir])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  const handleWrite = async (e: React.FormEvent) => {
    e.preventDefault()
    setWriteStatus(null)
    try {
      const res = await fetch('/api/storage/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: writePath, contents: writeContents, disk }),
      })
      const data = await res.json()
      if (res.ok) {
        setWriteStatus({ type: 'success', msg: `Written ${data.size} bytes to ${data.path}` })
        setWritePath('')
        setWriteContents('')
        fetchFiles()
      } else {
        setWriteStatus({ type: 'error', msg: data.error ?? 'Write failed' })
      }
    } catch { setWriteStatus({ type: 'error', msg: 'Network error' }) }
  }

  const handleRead = async (path: string) => {
    setReadError('')
    setReadContents(null)
    setReadPath(path)
    try {
      const res = await fetch(`/api/storage/read?path=${encodeURIComponent(path)}&disk=${disk}`)
      const data = await res.json()
      if (res.ok) setReadContents(data.contents)
      else setReadError(data.error ?? 'Read failed')
    } catch { setReadError('Network error') }
  }

  const handleInfo = async (path: string) => {
    setFileInfo(null)
    setInfoPath(path)
    try {
      const res = await fetch(`/api/storage/info?path=${encodeURIComponent(path)}&disk=${disk}`)
      const data = await res.json()
      if (res.ok) setFileInfo(data)
    } catch { /* ignore */ }
  }

  const handleDelete = async (path: string) => {
    await fetch('/api/storage/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, disk }),
    })
    fetchFiles()
    if (readPath === path) { setReadContents(null); setReadPath('') }
    if (infoPath === path) { setFileInfo(null); setInfoPath('') }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`/api/storage/upload?disk=${disk}&directory=${currentDir || 'uploads'}`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) fetchFiles()
    } catch { /* ignore */ }
    e.target.value = ''
  }

  const navigateDir = (dir: string) => {
    setCurrentDir(dir)
    setReadContents(null)
    setReadPath('')
    setFileInfo(null)
    setInfoPath('')
  }

  const parentDir = currentDir.includes('/') ? currentDir.split('/').slice(0, -1).join('/') : currentDir ? '' : null

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const fmtDate = (ms: number) => new Date(ms).toLocaleString()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <nav className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors mr-2">&larr; Back</button>
            <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">{appName}</span>
            <span className="text-[10px] text-gray-600 hidden sm:inline ml-1">Storage</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Disk:</span>
            {(['local', 'public'] as const).map((d) => (
              <button key={d} onClick={() => setDisk(d)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  disk === d
                    ? 'text-emerald-400 bg-emerald-600/20 border-emerald-500/30'
                    : 'text-gray-500 bg-gray-900 border-gray-800 hover:text-gray-300'
                }`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Top info */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-5 py-4">
          <h1 className="text-lg font-bold text-emerald-400">@mantiq/filesystem</h1>
          <p className="text-sm text-gray-400 mt-1">
            Storage abstraction with driver-based architecture. Currently viewing the <span className="text-emerald-300 font-medium">{disk}</span> disk.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: File browser */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-200">File Browser</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {currentDir ? `/${currentDir}` : '/'} {loading && '(loading...)'}
                  </p>
                </div>
                <label className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer">
                  Upload
                  <input type="file" className="hidden" onChange={handleUpload} />
                </label>
              </div>

              {/* Directory navigation */}
              {parentDir !== null && (
                <button onClick={() => navigateDir(parentDir)}
                  className="w-full text-left text-xs text-gray-400 hover:text-gray-200 bg-gray-800/50 hover:bg-gray-800 rounded-lg px-3 py-2 mb-2 transition-colors">
                  .. (parent directory)
                </button>
              )}

              {/* Directories */}
              {dirs.map((d) => (
                <button key={d} onClick={() => navigateDir(d)}
                  className="w-full text-left text-xs text-amber-400 hover:text-amber-300 bg-gray-800/30 hover:bg-gray-800/60 rounded-lg px-3 py-2 mb-1 transition-colors flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {d.split('/').pop()}
                </button>
              ))}

              {/* Files */}
              {files.length === 0 && dirs.length === 0 && !loading && (
                <p className="text-xs text-gray-600 text-center py-6">Empty directory</p>
              )}
              {files.map((f) => (
                <div key={f.path} className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2 mb-1 group hover:bg-gray-800/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs text-gray-300 truncate">{f.path.split('/').pop()}</span>
                    <span className="text-[10px] text-gray-600">{fmtSize(f.size)}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleRead(f.path)} className="text-[10px] text-indigo-400 hover:text-indigo-300 px-1.5 py-0.5 rounded">Read</button>
                    <button onClick={() => handleInfo(f.path)} className="text-[10px] text-cyan-400 hover:text-cyan-300 px-1.5 py-0.5 rounded">Info</button>
                    <button onClick={() => handleDelete(f.path)} className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded">Del</button>
                  </div>
                </div>
              ))}
            </Card>

            {/* Write form */}
            <Card className="p-5">
              <h2 className="text-sm font-bold text-gray-200 mb-3">Write File</h2>
              <form onSubmit={handleWrite} className="space-y-3">
                <Input label="Path" placeholder="hello.txt" value={writePath} onChange={(e) => setWritePath(e.target.value)} required />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-400">Contents</label>
                  <textarea value={writeContents} onChange={(e) => setWriteContents(e.target.value)}
                    rows={4} placeholder="File contents..."
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono text-xs resize-none" />
                </div>
                <Btn type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4">
                  Write to {disk} disk
                </Btn>
                {writeStatus && <Alert type={writeStatus.type}>{writeStatus.msg}</Alert>}
              </form>
            </Card>
          </div>

          {/* Right column: Read + Info */}
          <div className="space-y-4">
            {/* Read viewer */}
            <Card className="p-5">
              <h2 className="text-sm font-bold text-gray-200 mb-3">File Contents</h2>
              {readPath ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-mono">{readPath}</p>
                  {readError ? (
                    <Alert type="error">{readError}</Alert>
                  ) : readContents !== null ? (
                    <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">{readContents}</pre>
                  ) : (
                    <p className="text-xs text-gray-600">Loading...</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600 text-center py-8">Click "Read" on a file to view its contents</p>
              )}
            </Card>

            {/* Info panel */}
            <Card className="p-5">
              <h2 className="text-sm font-bold text-gray-200 mb-3">File Info</h2>
              {fileInfo ? (
                <div className="space-y-2">
                  <InfoRow label="Path" value={fileInfo.path} />
                  <InfoRow label="Size" value={fmtSize(fileInfo.size)} />
                  <InfoRow label="Modified" value={fmtDate(fileInfo.lastModified)} />
                  <InfoRow label="MIME Type" value={fileInfo.mimeType ?? 'unknown'} />
                  <InfoRow label="Visibility" value={fileInfo.visibility} />
                </div>
              ) : (
                <p className="text-xs text-gray-600 text-center py-8">Click "Info" on a file to view its metadata</p>
              )}
            </Card>

            {/* API Reference */}
            <Card className="p-5">
              <h2 className="text-sm font-bold text-gray-200 mb-3">API Reference</h2>
              <div className="space-y-2 text-xs">
                {[
                  { method: 'storage()', desc: 'Get the default disk (FilesystemManager)' },
                  { method: "storage('s3')", desc: 'Get a specific disk by name' },
                  { method: '.put(path, contents)', desc: 'Write a file' },
                  { method: '.get(path)', desc: 'Read file as string' },
                  { method: '.exists(path)', desc: 'Check if file exists' },
                  { method: '.delete(path)', desc: 'Delete a file' },
                  { method: '.files(dir?)', desc: 'List files in directory' },
                  { method: '.copy(from, to)', desc: 'Copy a file' },
                  { method: '.move(from, to)', desc: 'Move/rename a file' },
                  { method: '.size(path)', desc: 'Get file size in bytes' },
                  { method: '.makeDirectory(path)', desc: 'Create a directory' },
                  { method: '.allFiles(dir?)', desc: 'List files recursively' },
                  { method: '.setVisibility(path, v)', desc: "Set 'public' or 'private'" },
                  { method: '.stream(path)', desc: 'Get ReadableStream' },
                  { method: '.append(path, text)', desc: 'Append to file' },
                  { method: '.prepend(path, text)', desc: 'Prepend to file' },
                ].map((item) => (
                  <div key={item.method} className="flex items-start gap-2">
                    <code className="text-emerald-400 font-mono shrink-0">{item.method}</code>
                    <span className="text-gray-500">{item.desc}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 px-5 py-4 space-y-2">
          <p className="text-xs text-gray-400">
            <span className="text-gray-300 font-medium">@mantiq/filesystem</span> — Storage abstraction with local, S3, GCS, R2 drivers.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-gray-600">
            <span>FilesystemManager</span><span>LocalDriver</span><span>NullDriver</span><span>FilesystemServiceProvider</span><span>storage() helper</span>
          </div>
        </div>
      </main>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-mono text-xs">{value}</span>
    </div>
  )
}

// ── Chat (Realtime Showcase) ──────────────────────────────────────────────────

interface ChatMessage {
  id: string
  userId: number
  userName: string
  text: string
  fileUrl?: string
  fileName?: string
  fileType?: string
  timestamp: number
}

interface OnlineMember {
  userId: number | string
  info: { name: string; email: string }
}

function useWebSocket(user: User) {
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([])
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; timer: ReturnType<typeof setTimeout> }>>(new Map())
  const wsRef = { current: ws }
  wsRef.current = ws

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const params = new URLSearchParams({ userId: String(user.id), name: user.name, email: user.email })
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?${params}`)

    socket.onopen = () => {
      setConnected(true)
      // Subscribe to presence channel
      socket.send(JSON.stringify({ event: 'subscribe', channel: 'presence:chat.lobby' }))
    }

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)

        switch (msg.event) {
          case 'member:here':
            setOnlineMembers(msg.data || [])
            break

          case 'member:joined':
            setOnlineMembers((prev) => {
              if (prev.find((m) => m.userId === msg.data.userId)) return prev
              return [...prev, msg.data]
            })
            break

          case 'member:left':
            setOnlineMembers((prev) => prev.filter((m) => m.userId !== msg.data.userId))
            setTypingUsers((prev) => {
              const next = new Map(prev)
              next.delete(String(msg.data.userId))
              return next
            })
            break

          case 'client:message': {
            const chatMsg: ChatMessage = {
              id: `${msg.data.userId}-${msg.data.timestamp}`,
              userId: msg.data.userId,
              userName: msg.data.userName,
              text: msg.data.text,
              fileUrl: msg.data.fileUrl,
              fileName: msg.data.fileName,
              fileType: msg.data.fileType,
              timestamp: msg.data.timestamp,
            }
            setMessages((prev) => [...prev, chatMsg])
            // Clear typing for this user
            setTypingUsers((prev) => {
              const next = new Map(prev)
              const entry = next.get(String(msg.data.userId))
              if (entry) clearTimeout(entry.timer)
              next.delete(String(msg.data.userId))
              return next
            })
            break
          }

          case 'client:typing': {
            const uid = String(msg.data.userId)
            setTypingUsers((prev) => {
              const next = new Map(prev)
              const existing = next.get(uid)
              if (existing) clearTimeout(existing.timer)
              const timer = setTimeout(() => {
                setTypingUsers((p) => { const n = new Map(p); n.delete(uid); return n })
              }, 3000)
              next.set(uid, { name: msg.data.userName, timer })
              return next
            })
            break
          }

          case 'pong':
          case 'connected':
          case 'subscribed':
            break
        }
      } catch { /* ignore parse errors */ }
    }

    socket.onclose = () => setConnected(false)
    socket.onerror = () => setConnected(false)

    setWs(socket)

    // Ping keepalive
    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: 'ping' }))
      }
    }, 20000)

    return () => {
      clearInterval(pingInterval)
      socket.close()
    }
  }, [user.id, user.name, user.email])

  const sendMessage = useCallback((text: string, file?: { url: string; name: string; type: string }) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const data: any = {
      userId: user.id,
      userName: user.name,
      text,
      timestamp: Date.now(),
    }
    if (file) {
      data.fileUrl = file.url
      data.fileName = file.name
      data.fileType = file.type
    }
    ws.send(JSON.stringify({ event: 'whisper', channel: 'presence:chat.lobby', type: 'message', data }))
    // Add to local messages immediately (whisper doesn't echo back to sender)
    setMessages((prev) => [...prev, { id: `${user.id}-${data.timestamp}`, ...data }])
  }, [ws, user])

  const sendTyping = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      event: 'whisper',
      channel: 'presence:chat.lobby',
      type: 'typing',
      data: { userId: user.id, userName: user.name },
    }))
  }, [ws, user])

  return { connected, messages, onlineMembers, typingUsers, sendMessage, sendTyping }
}

function SSEDemo() {
  const [sseConnected, setSseConnected] = useState(false)
  const [sseEvents, setSseEvents] = useState<Array<{ id: string; event: string; data: any; time: string }>>([])
  const [sseChannel, setSseChannel] = useState('announcements')
  const [sseBroadcastEvent, setSseBroadcastEvent] = useState('notification')
  const [sseBroadcastMsg, setSseBroadcastMsg] = useState('Hello from SSE!')
  const [eventSource, setEventSource] = useState<EventSource | null>(null)

  const connectSSE = () => {
    if (eventSource) { eventSource.close(); setEventSource(null); setSseConnected(false) }
    const es = new EventSource(`/api/chat/sse?channels=${sseChannel}`)
    es.addEventListener('connected', (e) => {
      setSseConnected(true)
      setSseEvents((prev) => [...prev, { id: String(prev.length), event: 'connected', data: JSON.parse(e.data), time: new Date().toLocaleTimeString() }])
    })
    es.addEventListener('subscribed', (e) => {
      setSseEvents((prev) => [...prev, { id: String(prev.length), event: 'subscribed', data: JSON.parse(e.data), time: new Date().toLocaleTimeString() }])
    })
    es.addEventListener('broadcast', (e) => {
      setSseEvents((prev) => [...prev, { id: String(prev.length), event: 'broadcast', data: JSON.parse(e.data), time: new Date().toLocaleTimeString() }])
    })
    // Catch any custom event names
    es.onmessage = (e) => {
      setSseEvents((prev) => [...prev, { id: String(prev.length), event: 'message', data: JSON.parse(e.data), time: new Date().toLocaleTimeString() }])
    }
    es.onerror = () => { setSseConnected(false) }
    setEventSource(es)
  }

  const disconnectSSE = () => {
    eventSource?.close()
    setEventSource(null)
    setSseConnected(false)
  }

  const broadcastSSE = async () => {
    await fetch('/api/chat/sse/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: sseChannel, event: sseBroadcastEvent, data: { message: sseBroadcastMsg, timestamp: Date.now() } }),
    })
  }

  return (
    <div className="border-t border-gray-800/50 flex flex-col">
      <div className="px-3 py-2 border-b border-gray-800/30">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">SSE Demo</h4>
          <div className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400' : 'bg-gray-600'}`} />
        </div>
      </div>
      <div className="px-3 py-2 space-y-2">
        <input value={sseChannel} onChange={(e) => setSseChannel(e.target.value)} placeholder="Channel"
          className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-indigo-500/50" />
        <div className="flex gap-1">
          {!sseConnected ? (
            <button onClick={connectSSE} className="flex-1 text-[10px] bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded px-2 py-1 hover:bg-emerald-600/30 transition-colors">Connect</button>
          ) : (
            <button onClick={disconnectSSE} className="flex-1 text-[10px] bg-red-600/20 text-red-400 border border-red-500/20 rounded px-2 py-1 hover:bg-red-600/30 transition-colors">Disconnect</button>
          )}
        </div>
        {sseConnected && (
          <>
            <input value={sseBroadcastEvent} onChange={(e) => setSseBroadcastEvent(e.target.value)} placeholder="Event name"
              className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-indigo-500/50" />
            <input value={sseBroadcastMsg} onChange={(e) => setSseBroadcastMsg(e.target.value)} placeholder="Message"
              className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-indigo-500/50" />
            <button onClick={broadcastSSE} className="w-full text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded px-2 py-1 hover:bg-indigo-600/30 transition-colors">
              Broadcast
            </button>
          </>
        )}
        {/* Event log */}
        {sseEvents.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {sseEvents.slice(-10).map((ev) => (
              <div key={ev.id} className="text-[10px] text-gray-500 flex items-start gap-1">
                <span className="text-gray-600 shrink-0">{ev.time}</span>
                <span className={`shrink-0 font-medium ${ev.event === 'broadcast' ? 'text-indigo-400' : 'text-emerald-500'}`}>{ev.event}</span>
                <span className="text-gray-600 truncate">{JSON.stringify(ev.data)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-gray-800/30">
        <p className="text-[10px] text-gray-600">
          <span className="text-gray-500 font-medium">@mantiq/realtime</span> — WebSocket + SSE
        </p>
      </div>
    </div>
  )
}

function ChatRoom({ appName, user, onBack }: { appName: string; user: User; onBack: () => void }) {
  const { connected, messages, onlineMembers, typingUsers, sendMessage, sendTyping } = useWebSocket(user)
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const messagesEndRef = { current: null as HTMLDivElement | null }
  const fileInputRef = { current: null as HTMLInputElement | null }
  const typingTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null }

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input.trim())
    setInput('')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    // Throttle typing indicator to once per 2 seconds
    if (!typingTimeoutRef.current) {
      sendTyping()
      typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null }, 2000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/chat/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        sendMessage(file.name, { url: data.url, name: data.name, type: data.type })
      }
    } catch { /* ignore */ }
    setUploading(false)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const typingList = [...typingUsers.values()].map((t) => t.name)

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isImage = (type?: string) => type?.startsWith('image/')

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md shrink-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors" title="Back">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <span className="text-sm font-bold text-white">{appName}</span>
              <span className="text-[10px] text-gray-600 hidden sm:inline">Realtime Chat</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`} />
              <span className="text-[11px] text-gray-500">{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">{user.name[0]}</div>
              <span className="text-xs text-gray-300">{user.name}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-3">
                <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                <p className="text-sm">No messages yet. Say hello!</p>
                <p className="text-xs text-gray-700">Messages are peer-to-peer via WebSocket — no database.</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const isOwn = msg.userId === user.id
              const showAvatar = i === 0 || messages[i - 1].userId !== msg.userId || msg.timestamp - messages[i - 1].timestamp > 60000
              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}>
                  <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {showAvatar ? (
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white ${isOwn ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                        {msg.userName[0]}
                      </div>
                    ) : <div className="w-7 flex-shrink-0" />}
                    <div>
                      {showAvatar && (
                        <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? 'justify-end' : ''}`}>
                          <span className="text-[11px] font-medium text-gray-400">{isOwn ? 'You' : msg.userName}</span>
                          <span className="text-[10px] text-gray-600">{formatTime(msg.timestamp)}</span>
                        </div>
                      )}
                      <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${isOwn ? 'bg-indigo-600 text-white rounded-tr-md' : 'bg-gray-800 text-gray-200 rounded-tl-md'}`}>
                        {msg.fileUrl && (
                          <div className="mb-1.5">
                            {isImage(msg.fileType) ? (
                              <img src={msg.fileUrl} alt={msg.fileName} className="rounded-lg max-w-[280px] max-h-[200px] object-cover" />
                            ) : (
                              <a href={msg.fileUrl} target="_blank" rel="noreferrer"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isOwn ? 'bg-indigo-700/50 hover:bg-indigo-700/70' : 'bg-gray-700/50 hover:bg-gray-700/70'} transition-colors`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                <span className="truncate">{msg.fileName || 'Attachment'}</span>
                              </a>
                            )}
                          </div>
                        )}
                        {msg.text && !msg.fileUrl && msg.text}
                        {msg.text && msg.fileUrl && msg.text !== msg.fileName && <span>{msg.text}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={(el) => { messagesEndRef.current = el }} />
          </div>

          {/* Typing indicator */}
          <div className="px-4 h-6 flex items-center">
            {typingList.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[11px] text-gray-500">
                  {typingList.length === 1 ? `${typingList[0]} is typing` : `${typingList.join(', ')} are typing`}
                </span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-800/80 px-4 py-3 shrink-0">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input type="file" ref={(el) => { fileInputRef.current = el }} className="hidden" onChange={handleFileUpload} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || !connected}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                title="Share file">
                {uploading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                )}
              </button>
              <input
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={!connected}
                placeholder={connected ? 'Type a message...' : 'Connecting...'}
                className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                autoFocus
              />
              <button type="submit" disabled={!input.trim() || !connected}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </form>
          </div>
        </div>

        {/* Online members sidebar */}
        <div className="w-64 border-l border-gray-800/80 bg-gray-950 shrink-0 hidden lg:flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800/50">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Online — {onlineMembers.length}</h3>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {onlineMembers.map((m) => {
              const isTyping = typingUsers.has(String(m.userId))
              return (
                <div key={String(m.userId)} className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-gray-900/50 transition-colors">
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${Number(m.userId) === user.id ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                      {m.info.name[0]}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-gray-950 rounded-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 truncate">
                      {m.info.name}
                      {Number(m.userId) === user.id && <span className="text-[10px] text-gray-600 ml-1">(you)</span>}
                    </p>
                    {isTyping ? (
                      <p className="text-[10px] text-indigo-400 flex items-center gap-1">
                        typing
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-600 truncate">{m.info.email}</p>
                    )}
                  </div>
                </div>
              )
            })}
            {onlineMembers.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-6">No one online yet</p>
            )}
          </div>

          {/* SSE Demo */}
          <SSEDemo />
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function App({ appName = 'MantiqJS', currentUser = null, currentPage }: AppProps) {
  const [user, setUser] = useState<User | null>(currentUser)
  const initialPage = currentPage === 'validation' ? 'validation' as const : currentPage === 'cli' ? 'cli' as const : currentPage === 'storage' ? 'storage' as const : currentPage === 'chat' ? 'chat' as const : 'login' as const
  const [page, setPage] = useState<'login' | 'register' | 'validation' | 'cli' | 'storage' | 'chat'>(initialPage)

  if (page === 'validation') {
    return <ValidationPlayground appName={appName} onBack={() => { window.location.href = '/' }} />
  }

  if (page === 'cli') {
    return <CLIDocs appName={appName} onBack={() => { window.location.href = '/' }} />
  }

  if (page === 'storage') {
    return <StoragePlayground appName={appName} onBack={() => { window.location.href = '/' }} />
  }

  if (page === 'chat') {
    if (!user) {
      // Chat requires auth — redirect to login
      return <LoginPage appName={appName} onLogin={(u) => { setUser(u) }} onGoRegister={() => setPage('register')} />
    }
    return <ChatRoom appName={appName} user={user} onBack={() => { window.location.href = '/' }} />
  }

  if (!user) {
    return page === 'login'
      ? <LoginPage appName={appName} onLogin={setUser} onGoRegister={() => setPage('register')} />
      : <RegisterPage appName={appName} onRegister={setUser} onGoLogin={() => setPage('login')} />
  }

  return <Dashboard appName={appName} user={user} onLogout={() => setUser(null)} onValidation={() => setPage('validation')} onCli={() => setPage('cli')} onStorage={() => setPage('storage')} onChat={() => setPage('chat')} />
}
