<script lang="ts">
  import { post } from '$lib/api'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import AppSidebar from './AppSidebar.svelte'
  import type { Snippet } from 'svelte'

  let {
    children,
    currentUser = null,
    appName = 'Mantiq',
    navigate,
    activePath,
  }: {
    children: Snippet
    currentUser?: { name: string; email: string; role?: string } | null
    appName?: string
    navigate: (href: string) => void
    activePath: string
  } = $props()

  const user = $derived(currentUser ?? { name: 'User', email: 'user@example.com' })

  async function handleLogout() {
    await post('/logout', {})
    navigate('/login')
  }
</script>

<Sidebar.Provider>
  <AppSidebar
    {user}
    {appName}
    {activePath}
    {navigate}
    onLogout={handleLogout}
  />
  <Sidebar.Inset>
    {@render children()}
  </Sidebar.Inset>
</Sidebar.Provider>
