<script lang="ts">
  import * as Sidebar from '$lib/components/ui/sidebar'
  import NavGroup from './NavGroup.svelte'
  import NavUser from './NavUser.svelte'
  import { sidebarData } from './sidebar-data'
  import { Command } from 'lucide-svelte'

  let {
    user,
    appName,
    activePath,
    navigate,
    onLogout,
  }: {
    user: { name: string; email: string; role?: string }
    appName: string
    activePath: string
    navigate: (href: string) => void
    onLogout: () => void
  } = $props()
</script>

<Sidebar.Root variant="inset" collapsible="icon">
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          size="lg"
          class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          onclick={() => navigate('/dashboard')}
          tooltipContent={appName}
        >
          <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Command class="size-4" />
          </div>
          <div class="grid flex-1 text-left text-sm leading-tight">
            <span class="truncate font-semibold">{appName}</span>
            <span class="truncate text-xs text-muted-foreground">
              Admin Panel
            </span>
          </div>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>

  <Sidebar.Content>
    {#each sidebarData as group (group.title)}
      <NavGroup
        {group}
        {activePath}
        {navigate}
      />
    {/each}
  </Sidebar.Content>

  <Sidebar.Footer>
    <NavUser {user} {navigate} {onLogout} />
  </Sidebar.Footer>

  <Sidebar.Rail />
</Sidebar.Root>
