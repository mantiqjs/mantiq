<script setup lang="ts">
import { post } from '@/lib/api'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar.vue'

const props = withDefaults(defineProps<{
  currentUser?: { name: string; email: string; role?: string } | null
  appName?: string
  navigate: (href: string) => void
  activePath: string
}>(), {
  appName: 'Mantiq',
})

async function handleLogout() {
  await post('/logout', {})
  props.navigate('/login')
}

const user = props.currentUser ?? { name: 'User', email: 'user@example.com' }
</script>

<template>
  <SidebarProvider :default-open="true">
    <AppSidebar
      :user="user"
      :app-name="appName"
      :active-path="activePath"
      :navigate="navigate"
      :on-logout="handleLogout"
    />
    <SidebarInset>
      <slot />
    </SidebarInset>
  </SidebarProvider>
</template>
