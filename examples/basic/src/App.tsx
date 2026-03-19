import { useState, useEffect, useCallback } from 'react'

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

function Dashboard({ appName, user, onLogout, onValidation }: { appName: string; user: User; onLogout: () => void; onValidation: () => void }) {
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

        {/* Footer */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-gray-600">
            <span>Bun</span><span>@mantiq/core</span><span>@mantiq/auth</span><span>@mantiq/database</span><span>React</span><span>Tailwind</span>
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

// ── Root ──────────────────────────────────────────────────────────────────────

export function App({ appName = 'MantiqJS', currentUser = null, currentPage }: AppProps) {
  const [user, setUser] = useState<User | null>(currentUser)
  const initialPage = currentPage === 'validation' ? 'validation' as const : 'login' as const
  const [page, setPage] = useState<'login' | 'register' | 'validation'>(initialPage)

  if (page === 'validation') {
    return <ValidationPlayground appName={appName} onBack={() => { window.location.href = '/' }} />
  }

  if (!user) {
    return page === 'login'
      ? <LoginPage appName={appName} onLogin={setUser} onGoRegister={() => setPage('register')} />
      : <RegisterPage appName={appName} onRegister={setUser} onGoLogin={() => setPage('login')} />
  }

  return <Dashboard appName={appName} user={user} onLogout={() => setUser(null)} onValidation={() => setPage('validation')} />
}
