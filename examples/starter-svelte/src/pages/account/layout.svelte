<script lang="ts">
  import AuthenticatedLayout from '$lib/components/layout/AuthenticatedLayout.svelte'
  import Header from '$lib/components/layout/Header.svelte'
  import Main from '$lib/components/layout/Main.svelte'
  import { Separator } from '$lib/components/ui/separator'
  import { User, Lock, Palette } from 'lucide-svelte'
  import type { Component, Snippet } from 'svelte'

  let {
    children,
    appName,
    currentUser,
    navigate,
    activePath,
  }: {
    children: Snippet
    appName?: string
    currentUser?: any
    navigate: (href: string) => void
    activePath: string
  } = $props()

  const sidebarNav: { title: string; href: string; icon: Component }[] = [
    { title: 'Profile', href: '/account/profile', icon: User },
    { title: 'Security', href: '/account/security', icon: Lock },
    { title: 'Preferences', href: '/account/preferences', icon: Palette },
  ]
</script>

<AuthenticatedLayout {currentUser} {appName} {navigate} {activePath}>
  <Header fixed {navigate}>
    <h1 class="text-lg font-semibold">Settings</h1>
  </Header>
  <Main>
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
      <p class="text-muted-foreground">
        Manage your account settings and preferences.
      </p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="lg:w-48">
        <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-x-auto">
          {#each sidebarNav as item (item.href)}
            {@const Icon = item.icon}
            <a
              href={item.href}
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground {activePath === item.href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}"
            >
              <Icon class="w-4 h-4" />
              {item.title}
            </a>
          {/each}
        </nav>
      </aside>
      <div class="flex-1 lg:max-w-2xl">
        {@render children()}
      </div>
    </div>
  </Main>
</AuthenticatedLayout>
