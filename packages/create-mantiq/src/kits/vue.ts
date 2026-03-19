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
import { ref } from 'vue'
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

async function handleSubmit() {
  error.value = ''; loading.value = true
  const { ok, data } = await post('/login', { email: email.value, password: password.value })
  if (ok) props.navigate('/dashboard')
  else error.value = data?.error ?? 'Login failed'
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 flex">
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950 via-gray-950 to-gray-950 items-center justify-center p-16 relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(99,102,241,0.08),transparent_60%)]" />
      <div class="relative space-y-6 max-w-md">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span class="text-2xl font-bold text-white">{{ appName }}</span>
        </div>
        <h2 class="text-4xl font-bold text-white leading-tight">Build something<br>amazing.</h2>
        <p class="text-gray-400 text-lg leading-relaxed">Session auth, encrypted cookies, CSRF protection — all wired up and ready to go.</p>
      </div>
    </div>
    <div class="flex-1 flex items-center justify-center p-8">
      <div class="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md p-8 space-y-6">
        <div>
          <h1 class="text-xl font-bold text-white">Welcome back</h1>
          <p class="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>
        <div v-if="error" class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{{ error }}</div>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-400">Email</label>
            <input v-model="email" type="email" required class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-400">Password</label>
            <input v-model="password" type="password" required class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
          </div>
          <button type="submit" :disabled="loading" class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors">Sign in</button>
        </form>
        <p class="text-sm text-gray-500 text-center">Don't have an account? <a href="/register" class="text-indigo-400 hover:text-indigo-300">Register</a></p>
      </div>
    </div>
  </div>
</template>
`,

    'src/pages/Register.vue': `<script setup lang="ts">
import { ref } from 'vue'
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

async function handleSubmit() {
  error.value = ''; loading.value = true
  const { ok, data } = await post('/register', { name: name.value, email: email.value, password: password.value })
  if (ok) props.navigate('/dashboard')
  else error.value = data?.error?.message ?? data?.error ?? 'Registration failed'
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 flex">
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950 via-gray-950 to-gray-950 items-center justify-center p-16 relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(99,102,241,0.08),transparent_60%)]" />
      <div class="relative space-y-6 max-w-md">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span class="text-2xl font-bold text-white">{{ appName }}</span>
        </div>
        <h2 class="text-4xl font-bold text-white leading-tight">Build something<br>amazing.</h2>
        <p class="text-gray-400 text-lg leading-relaxed">Session auth, encrypted cookies, CSRF protection — all wired up and ready to go.</p>
      </div>
    </div>
    <div class="flex-1 flex items-center justify-center p-8">
      <div class="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md p-8 space-y-6">
        <div>
          <h1 class="text-xl font-bold text-white">Create an account</h1>
          <p class="text-sm text-gray-500 mt-1">Get started with {{ appName }}</p>
        </div>
        <div v-if="error" class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{{ error }}</div>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-400">Name</label>
            <input v-model="name" required class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-400">Email</label>
            <input v-model="email" type="email" required class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-400">Password</label>
            <input v-model="password" type="password" required class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
          </div>
          <button type="submit" :disabled="loading" class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors">Create account</button>
        </form>
        <p class="text-sm text-gray-500 text-center">Already have an account? <a href="/login" class="text-indigo-400 hover:text-indigo-300">Sign in</a></p>
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
  if (!props.users?.length) fetchUsers()
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <nav class="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
      <div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span class="text-sm font-bold text-white">{{ appName }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-400">{{ currentUser?.name }}</span>
          <button @click="handleLogout" class="text-xs text-gray-500 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-3 py-1.5 transition-colors">Logout</button>
        </div>
      </div>
    </nav>
    <main class="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 class="text-xl font-bold text-white">Dashboard</h1>
        <p class="text-sm text-gray-500 mt-1">Welcome back, {{ currentUser?.name }}.</p>
      </div>
      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 class="text-sm font-bold text-gray-200">Users</h2>
          <span class="text-xs text-gray-500">{{ loading ? 'Loading...' : users.length + ' total' }}</span>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
              <th class="px-5 py-3 font-medium">Name</th>
              <th class="px-5 py-3 font-medium">Email</th>
              <th class="px-5 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800/60">
            <tr v-for="u in users" :key="u.id" class="hover:bg-gray-900/50 transition-colors">
              <td class="px-5 py-3 text-gray-200">{{ u.name }}</td>
              <td class="px-5 py-3 text-gray-400">{{ u.email }}</td>
              <td class="px-5 py-3">
                <span :class="u.role === 'admin' ? 'bg-purple-500/15 text-purple-300 border-purple-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'" class="text-[10px] px-2 py-0.5 rounded-full font-medium border">{{ u.role }}</span>
              </td>
            </tr>
            <tr v-if="users.length === 0 && !loading">
              <td colspan="3" class="px-5 py-8 text-center text-gray-600">No users found</td>
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
