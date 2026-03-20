import type { TemplateContext } from '../templates.ts'

export function getSvelteTemplates(ctx: TemplateContext): Record<string, string> {
  return {
    'vite.config.ts': `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  publicDir: false,
  build: {
    outDir: 'public/build',
    manifest: true,
    emptyOutDir: true,
    rollupOptions: {
      input: ['src/main.ts', 'src/style.css'],
    },
  },
})
`,

    'svelte.config.js': `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
}
`,

    'src/style.css': `@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fadeUp 0.4s ease-out; }
`,

    'src/pages.ts': `import Login from './pages/Login.svelte'
import Register from './pages/Register.svelte'
import Dashboard from './pages/Dashboard.svelte'

export const pages: Record<string, any> = {
  Login,
  Register,
  Dashboard,
}
`,

    'src/lib/api.ts': `export async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } })
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  return { ok: res.ok, status: res.status, data }
}

export function post(url, body) {
  return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
`,

    'src/main.ts': `import './style.css'
import App from './App.svelte'
import { pages } from './pages.ts'

const target = document.getElementById('app')!
const data = (window as any).__MANTIQ_DATA__ ?? {}

const app = new App({
  target,
  props: { pages, initialData: data },
  hydrate: !!target.innerHTML.trim(),
})

export default app
`,

    'src/ssr.ts': `import App from './App.svelte'
import { pages } from './pages.ts'

export function render(_url: string, data?: Record<string, any>) {
  const { html, head } = (App as any).render({ pages, initialData: data })
  return { html, head }
}
`,

    'src/App.svelte': `<script lang="ts">
  import { onMount, onDestroy, setContext } from 'svelte'

  export let pages: Record<string, any> = {}
  export let initialData: Record<string, any> = {}

  const windowData = typeof window !== 'undefined' ? (window as any).__MANTIQ_DATA__ : {}
  const initial = initialData ?? windowData

  let currentPage: string = initial._page ?? 'Login'
  let pageData: Record<string, any> = initial

  $: PageComponent = pages[currentPage] ?? null

  // Initialize theme immediately to prevent flash
  if (typeof window !== 'undefined') {
    const theme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }

  async function navigate(href: string) {
    const res = await fetch(href, {
      headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
    })
    const newData = await res.json()
    currentPage = newData._page
    pageData = newData
    history.pushState(null, '', newData._url)
  }

  setContext('navigate', navigate)

  function handleClick(e: MouseEvent) {
    const anchor = (e.target as HTMLElement).closest('a')
    const href = anchor?.getAttribute('href')
    if (!href?.startsWith('/') || anchor?.target || e.ctrlKey || e.metaKey) return
    const spaRoutes = ['/login', '/register', '/dashboard']
    if (!spaRoutes.some(r => href === r || href.startsWith(r + '?'))) return
    e.preventDefault()
    navigate(href)
  }

  function handlePop() { navigate(location.pathname) }

  onMount(() => {
    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePop)
  })

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePop)
    }
  })
</script>

{#if PageComponent}
  <svelte:component this={PageComponent} {...pageData} {navigate} />
{/if}
`,

    'src/pages/Login.svelte': `<script lang="ts">
  import { onMount } from 'svelte'
  import { post } from '../lib/api.ts'

  export let appName: string = '${ctx.name}'
  export let navigate: (href: string) => void

  let email = 'admin@example.com'
  let password = 'password'
  let error = ''
  let loading = false

  onMount(() => {
    const theme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  })

  async function handleSubmit() {
    error = ''; loading = true
    const { ok, data } = await post('/login', { email, password })
    if (ok) navigate('/dashboard')
    else error = data?.error ?? 'Login failed'
    loading = false
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
  <div class="w-full max-w-sm animate-fade-up">
    <div class="text-center mb-8">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{appName}</h2>
    </div>

    <div class="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm space-y-6">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your account</p>
      </div>

      {#if error}
        <div class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{error}</div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div class="space-y-1.5">
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input bind:value={email} id="email" type="email" required class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
        </div>
        <div class="space-y-1.5">
          <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <input bind:value={password} id="password" type="password" required class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
        </div>
        <button type="submit" disabled={loading} class="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
        Don't have an account? <a href="/register" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium">Register</a>
      </p>
    </div>
  </div>
</div>
`,

    'src/pages/Register.svelte': `<script lang="ts">
  import { onMount } from 'svelte'
  import { post } from '../lib/api.ts'

  export let appName: string = '${ctx.name}'
  export let navigate: (href: string) => void

  let name = ''
  let email = ''
  let password = ''
  let error = ''
  let loading = false

  onMount(() => {
    const theme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  })

  async function handleSubmit() {
    error = ''; loading = true
    const { ok, data } = await post('/register', { name, email, password })
    if (ok) navigate('/dashboard')
    else error = data?.error?.message ?? data?.error ?? 'Registration failed'
    loading = false
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
  <div class="w-full max-w-sm animate-fade-up">
    <div class="text-center mb-8">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{appName}</h2>
    </div>

    <div class="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm space-y-6">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Create an account</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Get started with {appName}</p>
      </div>

      {#if error}
        <div class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{error}</div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div class="space-y-1.5">
          <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input bind:value={name} id="name" required class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
        </div>
        <div class="space-y-1.5">
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input bind:value={email} id="email" type="email" required class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
        </div>
        <div class="space-y-1.5">
          <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <input bind:value={password} id="password" type="password" required class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
        </div>
        <button type="submit" disabled={loading} class="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
        Already have an account? <a href="/login" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium">Sign in</a>
      </p>
    </div>
  </div>
</div>
`,

    'src/pages/Dashboard.svelte': `<script lang="ts">
  import { onMount, getContext } from 'svelte'
  import { api, post } from '../lib/api.ts'

  export let appName: string = '${ctx.name}'
  export let currentUser: any = null
  export let users: any[] = []
  export let navigate: (href: string) => void

  const ctxNavigate = getContext<(href: string) => void>('navigate')

  let localUsers: any[] = users ?? []
  let loading = !users?.length
  let isDark = true
  let sidebarOpen = false
  let collapsed = false
  let accountOpen = false

  $: userInitials = currentUser?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? ''

  async function fetchUsers() {
    loading = true
    const { ok, data } = await api('/api/users')
    if (ok) localUsers = data.data ?? []
    loading = false
  }

  async function handleLogout() {
    await post('/logout', {})
    ;(navigate ?? ctxNavigate)('/login')
  }

  function toggleTheme() {
    isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }

  onMount(() => {
    const theme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    if (!users?.length) fetchUsers()
  })
</script>

<div class="min-h-screen flex bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
  <!-- Mobile overlay -->
  {#if sidebarOpen}
    <div class="fixed inset-0 bg-black/50 z-30 lg:hidden" on:click={() => sidebarOpen = false}></div>
  {/if}

  <!-- Sidebar -->
  <aside class="fixed inset-y-0 left-0 {sidebarOpen ? 'w-60 translate-x-0' : '-translate-x-full'} {collapsed ? 'lg:w-16' : 'lg:w-60'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-40 transition-all duration-200 lg:translate-x-0">
    <!-- App name -->
    <div class="h-14 flex items-center px-5 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span class="text-sm font-bold text-gray-900 dark:text-white {collapsed ? 'lg:hidden' : ''}">{appName}</span>
      </div>
    </div>

    <!-- Nav items -->
    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      <a href="/dashboard"
        on:click={() => sidebarOpen = false}
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        <span class="{collapsed ? 'lg:hidden' : ''}">Dashboard</span>
      </a>
    </nav>

    <!-- Collapse toggle -->
    <div class="px-3 py-2 hidden lg:block">
      <button on:click={() => collapsed = !collapsed} class="flex items-center justify-center w-full px-2.5 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <span class="text-xs font-mono">{collapsed ? '>>' : '<<'}</span>
      </button>
    </div>

    <!-- Bottom links -->
    <div class="px-3 py-4 mt-auto border-t border-gray-200 dark:border-gray-800 space-y-1">
      <a href="https://github.com/mantiqjs/mantiq"
        target="_blank"
        rel="noopener"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
        <span class="{collapsed ? 'lg:hidden' : ''}">Documentation</span>
      </a>
    </div>
  </aside>

  <!-- Main content -->
  <div class="flex-1 {collapsed ? 'lg:ml-16' : 'lg:ml-60'} flex flex-col min-h-screen transition-all duration-200">
    <!-- Header -->
    <header class="h-14 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
      <div class="flex items-center">
        <button on:click={() => sidebarOpen = !sidebarOpen} class="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden mr-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 class="text-sm font-semibold text-gray-900 dark:text-white">Dashboard</h1>
      </div>
      <div class="flex items-center gap-3">
        <button on:click={toggleTheme} class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle theme">
          {#if isDark}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          {/if}
        </button>
        <!-- Account dropdown -->
        <div class="relative">
          <button on:click={() => accountOpen = !accountOpen} class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div class="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {userInitials}
            </div>
            <span class="text-sm text-gray-700 dark:text-gray-300 hidden sm:block">{currentUser?.name}</span>
            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {#if accountOpen}
            <div class="fixed inset-0 z-40" on:click={() => accountOpen = false}></div>
            <div class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 z-50">
              <div class="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <div class="text-sm font-medium text-gray-900 dark:text-white">{currentUser?.name}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{currentUser?.email}</div>
              </div>
              <button on:click={handleLogout} class="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
                Sign out
              </button>
            </div>
          {/if}
        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="flex-1 px-6 py-8 space-y-6 animate-fade-up">
      <!-- Welcome card -->
      <div class="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Welcome back, {currentUser?.name}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Here's what's happening with your application.</p>
      </div>

      <!-- Users table -->
      <div class="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 class="text-sm font-bold text-gray-900 dark:text-gray-200">Users</h2>
          <span class="text-xs text-gray-500 dark:text-gray-400">{loading ? 'Loading...' : localUsers.length + ' total'}</span>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-800 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th class="px-5 py-3 font-medium">Name</th>
              <th class="px-5 py-3 font-medium">Email</th>
              <th class="px-5 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800/60">
            {#each localUsers as u (u.id)}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <td class="px-5 py-3 text-gray-900 dark:text-gray-200">{u.name}</td>
                <td class="px-5 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                <td class="px-5 py-3">
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-medium border {u.role === 'admin' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}">{u.role}</span>
                </td>
              </tr>
            {/each}
            {#if localUsers.length === 0 && !loading}
              <tr><td colspan="3" class="px-5 py-8 text-center text-gray-400 dark:text-gray-600">No users found</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    </main>
  </div>
</div>
`,
  }
}
