<script lang="ts">
  import {
    Home,
    Users,
    User,
    Lock,
    Palette,
    BookOpen,
    Github,
    FileText,
    ArrowRight,
  } from 'lucide-svelte'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import type { Component } from 'lucide-svelte'

  let {
    open = $bindable(false),
    navigate,
  }: {
    open: boolean
    navigate: (href: string) => void
  } = $props()

  interface SearchPage {
    title: string
    url: string
    icon: Component
    group: string
    external?: boolean
  }

  const pages: SearchPage[] = [
    { title: 'Dashboard', url: '/dashboard', icon: Home, group: 'Pages' },
    { title: 'Users', url: '/users', icon: Users, group: 'Pages' },
    { title: 'Profile', url: '/account/profile', icon: User, group: 'Settings' },
    { title: 'Security', url: '/account/security', icon: Lock, group: 'Settings' },
    { title: 'Preferences', url: '/account/preferences', icon: Palette, group: 'Settings' },
    { title: 'Documentation', url: 'https://github.com/mantiqjs/mantiq#readme', icon: BookOpen, group: 'Links', external: true },
    { title: 'GitHub', url: 'https://github.com/mantiqjs/mantiq', icon: Github, group: 'Links', external: true },
  ]

  let query = $state('')
  let selected = $state(0)

  const filtered = $derived(
    query.trim()
      ? pages.filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
      : pages
  )

  const groups = $derived([...new Set(filtered.map(p => p.group))])

  $effect(() => {
    // Reset selection when query changes
    query;
    selected = 0
  })

  function handleSelect(item: SearchPage) {
    open = false
    query = ''
    if (item.external) {
      window.open(item.url, '_blank')
    } else {
      navigate(item.url)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selected = Math.min(selected + 1, filtered.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selected = Math.max(selected - 1, 0)
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault()
      handleSelect(filtered[selected])
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="overflow-hidden p-0 gap-0 sm:max-w-[480px]">
    <div class="flex items-center border-b px-3">
      <FileText class="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
      <Input
        placeholder="Type a command or search..."
        bind:value={query}
        onkeydown={handleKeyDown}
        class="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        autofocus
      />
    </div>
    <div class="max-h-[300px] overflow-y-auto p-2">
      {#if filtered.length === 0}
        <p class="py-6 text-center text-sm text-muted-foreground">No results found.</p>
      {/if}
      {#each groups as group (group)}
        {@const items = filtered.filter(p => p.group === group)}
        {#if items.length > 0}
          <div>
            <p class="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group}</p>
            {#each items as item (item.url)}
              {@const idx = filtered.indexOf(item)}
              {@const Icon = item.icon}
              <button
                onclick={() => handleSelect(item)}
                class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors {idx === selected ? 'bg-accent text-accent-foreground' : 'text-foreground'}"
              >
                <Icon class="h-4 w-4 text-muted-foreground" />
                <span class="flex-1 text-left">{item.title}</span>
                {#if idx === selected}
                  <ArrowRight class="h-3 w-3 text-muted-foreground" />
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  </Dialog.Content>
</Dialog.Root>
