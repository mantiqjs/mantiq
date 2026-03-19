<script lang="ts">
  import { post } from '../lib/api.ts'

  export let appName: string = 'examples/kit-svelte'
  export let navigate: (href: string) => void

  let email = 'admin@example.com'
  let password = 'password'
  let error = ''
  let loading = false

  async function handleSubmit() {
    error = ''; loading = true
    const { ok, data } = await post('/login', { email, password })
    if (ok) navigate('/dashboard')
    else error = data?.error ?? 'Login failed'
    loading = false
  }
</script>

<div class="min-h-screen bg-gray-950 flex">
  <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950 via-gray-950 to-gray-950 items-center justify-center p-16 relative overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(99,102,241,0.08),transparent_60%)]"></div>
    <div class="relative space-y-6 max-w-md">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span class="text-2xl font-bold text-white">{appName}</span>
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
      {#if error}<div class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3.5 py-2.5 text-sm">{error}</div>{/if}
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-400">Email</label>
          <input bind:value={email} type="email" required class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
        </div>
        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-400">Password</label>
          <input bind:value={password} type="password" required class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
        </div>
        <button type="submit" disabled={loading} class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors">Sign in</button>
      </form>
      <p class="text-sm text-gray-500 text-center">Don't have an account? <a href="/register" class="text-indigo-400 hover:text-indigo-300">Register</a></p>
    </div>
  </div>
</div>
