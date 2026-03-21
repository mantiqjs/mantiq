<script setup lang="ts">
import { AuthenticatedLayout } from '@/components/layout'
import { Header } from '@/components/layout'
import { Main } from '@/components/layout'
import { TopNav } from '@/components/layout'
import type { TopNavLink } from '@/components/layout/TopNav.vue'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Download } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  appName?: string
  currentUser?: { id: number; name: string; email: string; role: string } | null
  navigate: (href: string) => void
}>(), {
  appName: 'Mantiq',
})

const topNav: TopNavLink[] = [
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
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const bars = [40, 30, 55, 45, 70, 60, 80, 50, 65, 45, 75, 55]
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const maxH = 160
const barW = 32
const gap = 48
const svgW = bars.length * gap
const svgH = maxH + 30
</script>

<template>
  <AuthenticatedLayout
    :current-user="currentUser"
    :app-name="appName"
    :navigate="navigate"
    active-path="/dashboard"
  >
    <Header :navigate="navigate">
      <TopNav :links="topNav" @link-click="navigate" />
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
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Total Revenue</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">$45,231.89</div>
                <p class="text-xs text-muted-foreground">+20.1% from last month</p>
              </CardContent>
            </Card>

            <!-- Subscriptions -->
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Subscriptions</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">+2,350</div>
                <p class="text-xs text-muted-foreground">+180.1% from last month</p>
              </CardContent>
            </Card>

            <!-- Sales -->
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Sales</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">+12,234</div>
                <p class="text-xs text-muted-foreground">+19% from last month</p>
              </CardContent>
            </Card>

            <!-- Active Now -->
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Active Now</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">+573</div>
                <p class="text-xs text-muted-foreground">+201 since last hour</p>
              </CardContent>
            </Card>
          </div>

          <!-- Bottom row: chart + recent sales -->
          <div class="grid gap-4 lg:grid-cols-7">
            <!-- Chart card -->
            <Card class="lg:col-span-4">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent class="pl-2">
                <svg
                  :viewBox="`0 0 ${svgW} ${svgH}`"
                  class="h-[350px] w-full"
                  preserveAspectRatio="none"
                >
                  <g v-for="(h, i) in bars" :key="i">
                    <rect
                      :x="i * gap + (gap - barW) / 2"
                      :y="maxH - (h / 100) * maxH"
                      :width="barW"
                      :height="(h / 100) * maxH"
                      rx="4"
                      class="fill-foreground/15"
                    />
                    <text
                      :x="i * gap + gap / 2"
                      :y="maxH + 18"
                      text-anchor="middle"
                      class="fill-muted-foreground text-[10px]"
                    >
                      {{ months[i] }}
                    </text>
                  </g>
                </svg>
              </CardContent>
            </Card>

            <!-- Recent sales card -->
            <Card class="lg:col-span-3">
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
                <CardDescription>You made 265 sales this month.</CardDescription>
              </CardHeader>
              <CardContent>
                <div class="space-y-8">
                  <div
                    v-for="sale in recentSales"
                    :key="sale.email"
                    class="flex items-center"
                  >
                    <Avatar class="h-9 w-9">
                      <AvatarFallback class="text-xs">
                        {{ getInitials(sale.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="ml-4 space-y-1">
                      <p class="text-sm font-medium leading-none">{{ sale.name }}</p>
                      <p class="text-sm text-muted-foreground">{{ sale.email }}</p>
                    </div>
                    <div class="ml-auto font-medium">{{ sale.amount }}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Main>
  </AuthenticatedLayout>
</template>
