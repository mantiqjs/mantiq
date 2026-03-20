import type { TemplateContext } from '../templates.ts'

export function getVueTemplates(ctx: TemplateContext): Record<string, string> {
  return {
    'vite.config.ts': `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
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

    'src/style.css': `@import "tailwindcss";
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fadeUp 0.4s ease-out; }
`,

    'src/pages.ts': `import Login from './pages/Login.vue'
import Register from './pages/Register.vue'
import Dashboard from './pages/Dashboard.vue'

export const pages: Record<string, any> = {
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

    'src/main.ts': `import './style.css'
import { createApp, createSSRApp } from 'vue'
import App from './App.vue'
import { pages } from './pages.ts'

const root = document.getElementById('app')!
const data = (window as any).__MANTIQ_DATA__ ?? {}

const app = root.innerHTML.trim()
  ? createSSRApp(App, { pages, initialData: data })
  : createApp(App, { pages, initialData: data })

app.mount('#app')
`,

    'src/ssr.ts': `import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import App from './App.vue'
import { pages } from './pages.ts'

export async function render(_url: string, data?: Record<string, any>) {
  const app = createSSRApp(App, { pages, initialData: data })
  return { html: await renderToString(app) }
}
`,

    'src/App.vue': `<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, provide } from 'vue'

const props = defineProps<{
  pages: Record<string, any>
  initialData?: Record<string, any>
}>()

const windowData = typeof window !== 'undefined' ? (window as any).__MANTIQ_DATA__ : {}
const initial = props.initialData ?? windowData

const currentPage = ref<string>(initial._page ?? 'Login')
const pageData = ref<Record<string, any>>(initial)
const PageComponent = shallowRef(props.pages[currentPage.value] ?? null)

async function navigate(href: string) {
  const res = await fetch(href, {
    headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
  })
  const newData = await res.json()
  currentPage.value = newData._page
  pageData.value = newData
  PageComponent.value = props.pages[newData._page] ?? null
  history.pushState(null, '', newData._url)
}

provide('navigate', navigate)

function handleClick(e: MouseEvent) {
  const anchor = (e.target as HTMLElement).closest('a')
  const href = anchor?.getAttribute('href')
  if (!href?.startsWith('/') || anchor?.target || e.ctrlKey || e.metaKey) return
  e.preventDefault()
  navigate(href)
}

function handlePop() { navigate(location.pathname) }

onMounted(() => {
  document.addEventListener('click', handleClick)
  window.addEventListener('popstate', handlePop)

  // Initialize theme: localStorage > system preference > dark default
  const theme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark')
  document.documentElement.classList.toggle('dark', theme === 'dark')
})

onUnmounted(() => {
  document.removeEventListener('click', handleClick)
  window.removeEventListener('popstate', handlePop)
})
</script>

<template>
  <component :is="PageComponent" v-bind="pageData" :navigate="navigate" v-if="PageComponent" />
</template>
`,

    'src/pages/Login.vue': `<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { post } from '../lib/api.ts'

const props = defineProps<{
  appName?: string
  navigate: (href: string) => void
}>()

const appName = props.appName ?? '${ctx.name}'
const email = ref('admin@example.com')
const password = ref('password')
const error = ref('')
const loading = ref(false)
const mounted = ref(false)

onMounted(() => {
  const theme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark')
  document.documentElement.classList.toggle('dark', theme === 'dark')
  requestAnimationFrame(() => { mounted.value = true })
})

async function handleSubmit() {
  error.value = ''; loading.value = true
  const { ok, data } = await post('/login', { email: email.value, password: password.value })
  if (ok) props.navigate('/dashboard')
  else error.value = data?.error ?? 'Login failed'
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12 transition-colors">
    <div
      :class="mounted ? 'animate-fade-up' : 'opacity-0'"
      class="w-full max-w-sm"
    >
      <!-- App name -->
      <div class="text-center mb-8">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ appName }}</h2>
      </div>

      <!-- Card -->
      <div class="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm space-y-6">
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your account</p>
        </div>

        <!-- Error -->
        <div v-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{{ error }}</div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-1.5">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              v-model="email"
              type="email"
              required
              class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <div class="space-y-1.5">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              v-model="password"
              type="password"
              required
              class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
          Don't have an account? <a href="/register" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium">Register</a>
        </p>
      </div>
    </div>
  </div>
</template>
`,

    'src/pages/Register.vue': `<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { post } from '../lib/api.ts'

const props = defineProps<{
  appName?: string
  navigate: (href: string) => void
}>()

const appName = props.appName ?? '${ctx.name}'
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const mounted = ref(false)

onMounted(() => {
  const theme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark')
  document.documentElement.classList.toggle('dark', theme === 'dark')
  requestAnimationFrame(() => { mounted.value = true })
})

async function handleSubmit() {
  error.value = ''; loading.value = true
  const { ok, data } = await post('/register', { name: name.value, email: email.value, password: password.value })
  if (ok) props.navigate('/dashboard')
  else error.value = data?.error?.message ?? data?.error ?? 'Registration failed'
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12 transition-colors">
    <div
      :class="mounted ? 'animate-fade-up' : 'opacity-0'"
      class="w-full max-w-sm"
    >
      <!-- App name -->
      <div class="text-center mb-8">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ appName }}</h2>
      </div>

      <!-- Card -->
      <div class="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm space-y-6">
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Create an account</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Get started with {{ appName }}</p>
        </div>

        <!-- Error -->
        <div v-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{{ error }}</div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-1.5">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input
              v-model="name"
              required
              class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <div class="space-y-1.5">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              v-model="email"
              type="email"
              required
              class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <div class="space-y-1.5">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              v-model="password"
              type="password"
              required
              class="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
          >
            {{ loading ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
          Already have an account? <a href="/login" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  </div>
</template>
`,

    'src/pages/Dashboard.vue': `<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api, post } from '../lib/api.ts'

const props = defineProps<{
  appName?: string
  currentUser?: any
  users?: any[]
  navigate: (href: string) => void
}>()

const appName = props.appName ?? '${ctx.name}'
const users = ref(props.users ?? [])
const loading = ref(!props.users?.length)
const isDark = ref(true)

function toggleTheme() {
  const dark = document.documentElement.classList.toggle('dark')
  isDark.value = dark
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

async function fetchUsers() {
  loading.value = true
  const { ok, data } = await api('/api/users')
  if (ok) users.value = data.data ?? []
  loading.value = false
}

async function handleLogout() {
  await post('/logout', {})
  props.navigate('/login')
}

onMounted(() => {
  const theme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark')
  document.documentElement.classList.toggle('dark', theme === 'dark')
  isDark.value = theme === 'dark'

  if (!props.users?.length) fetchUsers()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
    <!-- Navbar -->
    <nav class="border-b border-gray-200 dark:border-gray-800/80 bg-white/80 dark:bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
      <div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <span class="text-sm font-bold text-gray-900 dark:text-white">{{ appName }}</span>
        <div class="flex items-center gap-3">
          <!-- Dark/Light toggle -->
          <button
            @click="toggleTheme"
            class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <!-- Sun icon (shown in dark mode) -->
            <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <!-- Moon icon (shown in light mode) -->
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ currentUser?.name }}</span>
          <button
            @click="handleLogout"
            class="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>

    <main class="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <!-- Welcome section -->
      <div class="animate-fade-up">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Welcome back, {{ currentUser?.name }}.</p>
      </div>

      <!-- Quick links -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up">
        <a
          href="/heartbeat"
          class="group bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Heartbeat Dashboard</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Monitor application health</p>
            </div>
            <span class="text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </div>
        </a>
        <a
          href="/api/ping"
          class="group bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">API Ping</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Test API connectivity</p>
            </div>
            <span class="text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </div>
        </a>
      </div>

      <!-- Users table -->
      <div class="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-fade-up">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200">Users</h2>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ loading ? 'Loading...' : users.length + ' total' }}</span>
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
            <tr v-for="u in users" :key="u.id" class="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <td class="px-5 py-3 text-gray-800 dark:text-gray-200">{{ u.name }}</td>
              <td class="px-5 py-3 text-gray-500 dark:text-gray-400">{{ u.email }}</td>
              <td class="px-5 py-3">
                <span
                  :class="u.role === 'admin'
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'"
                  class="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                >
                  {{ u.role }}
                </span>
              </td>
            </tr>
            <tr v-if="users.length === 0 && !loading">
              <td colspan="3" class="px-5 py-8 text-center text-gray-400 dark:text-gray-600">No users found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>
`,
  }
}
