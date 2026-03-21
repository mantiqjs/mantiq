<script lang="ts">
  import AuthenticatedLayout from '$lib/components/layout/AuthenticatedLayout.svelte'
  import Header from '$lib/components/layout/Header.svelte'
  import Main from '$lib/components/layout/Main.svelte'
  import TopNav from '$lib/components/layout/TopNav.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar'
  import { Download } from 'lucide-svelte'

  let {
    appName = 'Mantiq',
    currentUser = null,
    navigate,
  }: {
    appName?: string
    currentUser?: { id: number; name: string; email: string } | null
    navigate: (href: string) => void
    [key: string]: any
  } = $props()

  const topNav = [
    { title: 'Overview', href: '/dashboard', isActive: true },
    { title: 'Sales', href: '/dashboard', isActive: false, disabled: true },
    { title: 'Tickets', href: '/dashboard', isActive: false, disabled: true },
    { title: 'Performance', href: '/dashboard', isActive: false, disabled: true },
  ]

  const recentSales = [
    { name: 'Olivia Martin', email: 'olivia.martin@email.com', amount: '+$1,999.00' },
    { name: 'Jackson Lee', email: 'jackson.lee@email.com', amount: '+$39.00' },
    { name: 'Isabella Nguyen', email: 'isabella.nguyen@email.com', amount: '+$299.00' },
    { name: 'William Kim', email: 'will@email.com', amount: '+$99.00' },
    { name: 'Sofia Davis', email: 'sofia.davis@email.com', amount: '+$39.00' },
  ]

  function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const bars = [40, 30, 55, 45, 70, 60, 80, 50, 65, 45, 75, 55]
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const maxH = 160
  const barW = 32
  const gap = 48
  const svgW = bars.length * gap
  const svgH = maxH + 30
</script>

<AuthenticatedLayout
  {currentUser}
  {appName}
  {navigate}
  activePath="/dashboard"
>
  <Header {navigate}>
    <TopNav links={topNav} onLinkClick={navigate} />
  </Header>
  <Main>
    <div class="space-y-4">
      <!-- Page title row -->
      <div class="flex items-center justify-between">
        <h2 class="text-3xl font-bold tracking-tight">Dashboard</h2>
        <Button variant="outline" size="sm" disabled class="gap-2">
          <Download class="h-4 w-4" />
          Download
        </Button>
      </div>

      <!-- Content -->
      <div class="space-y-4">
        <!-- Stat cards -->
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total Revenue -->
          <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
              <Card.Title class="text-sm font-medium">Total Revenue</Card.Title>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">$45,231.89</div>
              <p class="text-xs text-muted-foreground">+20.1% from last month</p>
            </Card.Content>
          </Card.Root>

          <!-- Subscriptions -->
          <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
              <Card.Title class="text-sm font-medium">Subscriptions</Card.Title>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">+2,350</div>
              <p class="text-xs text-muted-foreground">+180.1% from last month</p>
            </Card.Content>
          </Card.Root>

          <!-- Sales -->
          <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
              <Card.Title class="text-sm font-medium">Sales</Card.Title>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">+12,234</div>
              <p class="text-xs text-muted-foreground">+19% from last month</p>
            </Card.Content>
          </Card.Root>

          <!-- Active Now -->
          <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
              <Card.Title class="text-sm font-medium">Active Now</Card.Title>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">+573</div>
              <p class="text-xs text-muted-foreground">+201 since last hour</p>
            </Card.Content>
          </Card.Root>
        </div>

        <!-- Bottom row: chart + recent sales -->
        <div class="grid gap-4 lg:grid-cols-7">
          <!-- Chart card -->
          <Card.Root class="lg:col-span-4">
            <Card.Header>
              <Card.Title>Overview</Card.Title>
            </Card.Header>
            <Card.Content class="pl-2">
              <svg
                viewBox="0 0 {svgW} {svgH}"
                class="h-[350px] w-full"
                preserveAspectRatio="none"
              >
                {#each bars as h, i}
                  {@const barH = (h / 100) * maxH}
                  <g>
                    <rect
                      x={i * gap + (gap - barW) / 2}
                      y={maxH - barH}
                      width={barW}
                      height={barH}
                      rx={4}
                      class="fill-foreground/15"
                    />
                    <text
                      x={i * gap + gap / 2}
                      y={maxH + 18}
                      text-anchor="middle"
                      class="fill-muted-foreground text-[10px]"
                    >
                      {months[i]}
                    </text>
                  </g>
                {/each}
              </svg>
            </Card.Content>
          </Card.Root>

          <!-- Recent sales card -->
          <Card.Root class="lg:col-span-3">
            <Card.Header>
              <Card.Title>Recent Sales</Card.Title>
              <Card.Description>You made 265 sales this month.</Card.Description>
            </Card.Header>
            <Card.Content>
              <div class="space-y-8">
                {#each recentSales as sale}
                  <div class="flex items-center">
                    <Avatar class="h-9 w-9">
                      <AvatarFallback class="text-xs">
                        {getInitials(sale.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div class="ml-4 space-y-1">
                      <p class="text-sm font-medium leading-none">{sale.name}</p>
                      <p class="text-sm text-muted-foreground">{sale.email}</p>
                    </div>
                    <div class="ml-auto font-medium">{sale.amount}</div>
                  </div>
                {/each}
              </div>
            </Card.Content>
          </Card.Root>
        </div>
      </div>
    </div>
  </Main>
</AuthenticatedLayout>
