<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { cn } from '$lib/utils'
  import { Separator } from '$lib/components/ui/separator'
  import { SidebarTrigger } from '$lib/components/ui/sidebar'
  import { Button } from '$lib/components/ui/button'
  import ThemeToggle from './ThemeToggle.svelte'
  import SearchDialog from './SearchDialog.svelte'
  import { Search } from 'lucide-svelte'
  import type { Snippet } from 'svelte'

  let {
    fixed = false,
    navigate,
    children,
    class: className,
  }: {
    fixed?: boolean
    navigate?: (href: string) => void
    children?: Snippet
    class?: string
  } = $props()

  let offset = $state(0)
  let searchOpen = $state(false)

  function onScroll() {
    offset = document.body.scrollTop || document.documentElement.scrollTop
  }

  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      searchOpen = true
    }
  }

  function handleNavigate(href: string) {
    if (navigate) {
      navigate(href)
    } else {
      window.location.href = href
    }
  }

  onMount(() => {
    document.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('keydown', onKeyDown)
  })

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      document.removeEventListener('scroll', onScroll)
      document.removeEventListener('keydown', onKeyDown)
    }
  })
</script>

<header
  class={cn(
    'flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12',
    fixed && 'sticky top-0 z-10 bg-background',
    offset > 10 && fixed ? 'border-b' : '',
    className,
  )}
>
  <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
    <SidebarTrigger class="-ml-1" />
    <Separator orientation="vertical" class="mx-1 hidden h-4 md:block" />
    {#if children}
      {@render children()}
    {/if}
    <div class="ms-auto flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        class="h-8 w-8 sm:hidden"
        onclick={() => searchOpen = true}
      >
        <Search class="h-4 w-4" />
        <span class="sr-only">Search</span>
      </Button>
      <Button
        variant="outline"
        class="relative hidden h-8 justify-start rounded-md text-sm text-muted-foreground sm:flex sm:w-40 lg:w-64"
        onclick={() => searchOpen = true}
      >
        <Search class="mr-2 h-4 w-4" />
        Search...
        <kbd class="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium lg:flex">
          <span class="text-xs">&#x2318;</span>K
        </kbd>
      </Button>
      <ThemeToggle />
    </div>
  </div>
</header>
<SearchDialog bind:open={searchOpen} navigate={handleNavigate} />
