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
  import { onMount } from 'svelte'
  import { api, post } from '../lib/api.ts'

  export let appName: string = '${ctx.name}'
  export let currentUser: any = null
  export let users: any[] = []
  export let navigate: (href: string) => void

  let localUsers: any[] = users ?? []
  let loading = !users?.length
  let isDark = true

  async function fetchUsers() {
    loading = true
    const { ok, data } = await api('/api/users')
    if (ok) localUsers = data.data ?? []
    loading = false
  }

  async function handleLogout() {
    await post('/logout', {})
    navigate('/login')
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

<div class="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
  <nav class="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
    <div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
      <span class="text-sm font-bold text-gray-900 dark:text-white">{appName}</span>
      <div class="flex items-center gap-3">
        <button on:click={toggleTheme} class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle theme">
          {#if isDark}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          {/if}
        </button>
        <span class="text-xs text-gray-500 dark:text-gray-400">{currentUser?.name}</span>
        <button on:click={handleLogout} class="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5 transition-colors">Logout</button>
      </div>
    </div>
  </nav>

  <main class="max-w-5xl mx-auto px-6 py-8 space-y-6 animate-fade-up">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Welcome back, {currentUser?.name}.</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <a href="/heartbeat" class="group bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Heartbeat Dashboard</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Monitor application health</p>
          </div>
          <span class="text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
        </div>
      </a>
      <a href="/api/ping" class="group bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">API Ping</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Test API connectivity</p>
          </div>
          <span class="text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
        </div>
      </a>
    </div>

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
`,
  }
}
