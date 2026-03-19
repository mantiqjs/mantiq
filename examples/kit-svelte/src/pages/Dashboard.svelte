<script lang="ts">
  import { onMount } from 'svelte'
  import { api, post } from '../lib/api.ts'

  export let appName: string = 'examples/kit-svelte'
  export let currentUser: any = null
  export let users: any[] = []
  export let navigate: (href: string) => void

  let localUsers: any[] = users ?? []
  let loading = !users?.length

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

  onMount(() => {
    if (!users?.length) fetchUsers()
  })
</script>

<div class="min-h-screen bg-gray-950 text-gray-100">
  <nav class="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
    <div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span class="text-sm font-bold text-white">{appName}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-400">{currentUser?.name}</span>
        <button on:click={handleLogout} class="text-xs text-gray-500 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-3 py-1.5 transition-colors">Logout</button>
      </div>
    </div>
  </nav>
  <main class="max-w-5xl mx-auto px-6 py-8 space-y-6">
    <div>
      <h1 class="text-xl font-bold text-white">Dashboard</h1>
      <p class="text-sm text-gray-500 mt-1">Welcome back, {currentUser?.name}.</p>
    </div>
    <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 class="text-sm font-bold text-gray-200">Users</h2>
        <span class="text-xs text-gray-500">{loading ? 'Loading...' : localUsers.length + ' total'}</span>
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
          {#each localUsers as u (u.id)}
            <tr class="hover:bg-gray-900/50 transition-colors">
              <td class="px-5 py-3 text-gray-200">{u.name}</td>
              <td class="px-5 py-3 text-gray-400">{u.email}</td>
              <td class="px-5 py-3">
                <span class="text-[10px] px-2 py-0.5 rounded-full font-medium border {u.role === 'admin' ? 'bg-purple-500/15 text-purple-300 border-purple-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}">{u.role}</span>
              </td>
            </tr>
          {/each}
          {#if localUsers.length === 0 && !loading}
            <tr><td colspan="3" class="px-5 py-8 text-center text-gray-600">No users found</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </main>
</div>
