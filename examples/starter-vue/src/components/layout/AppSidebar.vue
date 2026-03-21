<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import NavGroup from './NavGroup.vue'
import NavUser from './NavUser.vue'
import type { NavUserUser } from './NavUser.vue'
import { sidebarData } from './sidebar-data'
import { Command } from 'lucide-vue-next'

const props = defineProps<{
  user: NavUserUser
  appName: string
  activePath: string
  navigate: (href: string) => void
  onLogout: () => void
}>()
</script>

<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            :tooltip="appName"
            @click="navigate('/dashboard')"
          >
            <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Command class="size-4" />
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ appName }}</span>
              <span class="truncate text-xs text-muted-foreground">
                Admin Panel
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <NavGroup
        v-for="group in sidebarData"
        :key="group.title"
        :group="group"
        :active-path="activePath"
        :navigate="navigate"
      />
    </SidebarContent>

    <SidebarFooter>
      <NavUser :user="user" :navigate="navigate" :on-logout="onLogout" />
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
