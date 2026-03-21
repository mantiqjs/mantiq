<script lang="ts">
  import { cn } from '$lib/utils'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import { Button } from '$lib/components/ui/button'
  import { Menu } from 'lucide-svelte'

  interface TopNavLink {
    title: string
    href: string
    isActive?: boolean
    disabled?: boolean
  }

  let {
    links,
    onLinkClick,
    class: className,
  }: {
    links: TopNavLink[]
    onLinkClick?: (href: string) => void
    class?: string
  } = $props()

  function handleClick(e: MouseEvent, href: string) {
    if (onLinkClick) {
      e.preventDefault()
      onLinkClick(href)
    }
  }
</script>

<!-- Desktop navigation -->
<nav
  class={cn(
    'hidden items-center gap-4 md:flex lg:gap-6',
    className,
  )}
>
  {#each links as link}
    <a
      href={link.href}
      onclick={(e: MouseEvent) => handleClick(e, link.href)}
      class={cn(
        'text-sm font-medium transition-colors hover:text-primary',
        link.isActive ? 'text-foreground' : 'text-muted-foreground',
        link.disabled && 'pointer-events-none opacity-50',
      )}
    >
      {link.title}
    </a>
  {/each}
</nav>

<!-- Mobile navigation -->
<div class="md:hidden">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button variant="outline" size="icon" class="h-8 w-8" {...props}>
          <Menu class="h-4 w-4" />
          <span class="sr-only">Toggle navigation</span>
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start">
      {#each links as link}
        <DropdownMenu.Item
          disabled={link.disabled}
          onclick={(e: MouseEvent) => {
            if (onLinkClick) {
              onLinkClick(link.href)
            }
          }}
          class={cn(!link.isActive && 'text-muted-foreground')}
        >
          {link.title}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
