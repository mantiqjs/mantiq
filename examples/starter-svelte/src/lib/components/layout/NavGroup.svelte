<script lang="ts">
  import { ChevronRight, ExternalLink } from 'lucide-svelte'
  import { Collapsible } from 'bits-ui'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { Badge } from '$lib/components/ui/badge'
  import type { NavGroup as NavGroupData } from './sidebar-data'

  let {
    group,
    activePath,
    navigate,
  }: {
    group: NavGroupData
    activePath: string
    navigate: (href: string) => void
  } = $props()

  const sidebar = Sidebar.useSidebar()

  function isActive(itemUrl: string, active: string): boolean {
    if (itemUrl === active) return true
    const itemBase = itemUrl.split('?')[0]
    const activeBase = active.split('?')[0]
    return itemBase === activeBase
  }

  function isGroupActive(items: NavGroupData['items'][number]['items'], active: string): boolean {
    if (!items) return false
    return items.some((sub) => isActive(sub.url, active))
  }
</script>

<Sidebar.Group>
  <Sidebar.GroupLabel>{group.title}</Sidebar.GroupLabel>
  <Sidebar.Menu>
    {#each group.items as item (item.title)}
      {#if item.items && item.items.length > 0}
        {#if sidebar.state === 'collapsed'}
          <!-- Collapsed: dropdown menu -->
          <Sidebar.MenuItem>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Sidebar.MenuButton
                    tooltipContent={item.title}
                    isActive={isGroupActive(item.items, activePath)}
                    {...props}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                    <ChevronRight class="ml-auto" />
                  </Sidebar.MenuButton>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content side="right" align="start" sideOffset={4}>
                <DropdownMenu.Label>{item.title}</DropdownMenu.Label>
                <DropdownMenu.Separator />
                {#each item.items as sub (sub.title)}
                  <DropdownMenu.Item onclick={() => navigate(sub.url)}>
                    <span>{sub.title}</span>
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Sidebar.MenuItem>
        {:else}
          <!-- Expanded: collapsible -->
          {@const childActive = isGroupActive(item.items, activePath)}
          <Collapsible.Root open={childActive} class="group/collapsible">
            <Sidebar.MenuItem>
              <Collapsible.Trigger>
                {#snippet child({ props })}
                  <Sidebar.MenuButton
                    tooltipContent={item.title}
                    isActive={childActive}
                    {...props}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                    <ChevronRight class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </Sidebar.MenuButton>
                {/snippet}
              </Collapsible.Trigger>
              <Collapsible.Content>
                <Sidebar.MenuSub>
                  {#each item.items as sub (sub.title)}
                    <Sidebar.MenuSubItem>
                      <Sidebar.MenuSubButton
                        isActive={isActive(sub.url, activePath)}
                        onclick={(e: MouseEvent) => {
                          e.preventDefault()
                          navigate(sub.url)
                        }}
                      >
                        <span>{sub.title}</span>
                      </Sidebar.MenuSubButton>
                    </Sidebar.MenuSubItem>
                  {/each}
                </Sidebar.MenuSub>
              </Collapsible.Content>
            </Sidebar.MenuItem>
          </Collapsible.Root>
        {/if}
      {:else if item.external}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton tooltipContent={item.title}>
            {#snippet child({ props })}
              <a href={item.url} target="_blank" rel="noopener noreferrer" {...props}>
                <item.icon />
                <span>{item.title}</span>
                <ExternalLink class="ml-auto h-3 w-3 text-muted-foreground" />
              </a>
            {/snippet}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {:else}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton
            tooltipContent={item.title}
            isActive={isActive(item.url, activePath)}
            onclick={(e: MouseEvent) => {
              e.preventDefault()
              navigate(item.url)
            }}
          >
            <item.icon />
            <span>{item.title}</span>
            {#if item.badge}
              <Badge
                variant="secondary"
                class="ml-auto text-[10px] px-1.5 py-0"
              >
                {item.badge}
              </Badge>
            {/if}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {/if}
    {/each}
  </Sidebar.Menu>
</Sidebar.Group>
