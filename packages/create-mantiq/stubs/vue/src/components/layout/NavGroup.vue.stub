<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronRight, ExternalLink } from 'lucide-vue-next'
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import type { NavGroup as NavGroupData } from './sidebar-data'

const props = defineProps<{
  group: NavGroupData
  activePath: string
  navigate: (href: string) => void
}>()

const { state } = useSidebar()

function isActive(itemUrl: string, activePath: string): boolean {
  if (itemUrl === activePath) return true
  const itemBase = itemUrl.split('?')[0]
  const activeBase = activePath.split('?')[0]
  return itemBase === activeBase
}

function isGroupActive(items: NavGroupData['items'][number]['items'], activePath: string): boolean {
  if (!items) return false
  return items.some((sub) => isActive(sub.url, activePath))
}
</script>

<template>
  <SidebarGroup>
    <SidebarGroupLabel>{{ group.title }}</SidebarGroupLabel>
    <SidebarMenu>
      <template v-for="item in group.items" :key="item.title">
        <!-- Items with sub-items: collapsed sidebar shows dropdown -->
        <template v-if="item.items && item.items.length > 0">
          <!-- Collapsed: dropdown -->
          <SidebarMenuItem v-if="state === 'collapsed'">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <SidebarMenuButton
                  :tooltip="item.title"
                  :is-active="isGroupActive(item.items, activePath)"
                >
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                  <ChevronRight class="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" :side-offset="4">
                <DropdownMenuLabel>{{ item.title }}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  v-for="sub in item.items"
                  :key="sub.title"
                  @select="navigate(sub.url)"
                >
                  <span>{{ sub.title }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>

          <!-- Expanded: collapsible -->
          <CollapsibleRoot
            v-else
            v-slot="{ open }"
            :default-open="isGroupActive(item.items, activePath)"
            as-child
          >
            <SidebarMenuItem>
              <CollapsibleTrigger as-child>
                <SidebarMenuButton
                  :tooltip="item.title"
                  :is-active="isGroupActive(item.items, activePath)"
                >
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                  <ChevronRight
                    class="ml-auto transition-transform duration-200"
                    :class="open && 'rotate-90'"
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem v-for="sub in item.items" :key="sub.title">
                    <SidebarMenuSubButton
                      :is-active="isActive(sub.url, activePath)"
                      as="button"
                      @click.prevent="navigate(sub.url)"
                    >
                      <span>{{ sub.title }}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </CollapsibleRoot>
        </template>

        <!-- External link -->
        <SidebarMenuItem v-else-if="item.external">
          <SidebarMenuButton :tooltip="item.title" as-child>
            <a :href="item.url" target="_blank" rel="noopener noreferrer">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
              <ExternalLink class="ml-auto h-3 w-3 text-muted-foreground" />
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <!-- Regular item -->
        <SidebarMenuItem v-else>
          <SidebarMenuButton
            :tooltip="item.title"
            :is-active="isActive(item.url, activePath)"
            @click.prevent="navigate(item.url)"
          >
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
            <Badge
              v-if="item.badge"
              variant="secondary"
              class="ml-auto text-[10px] px-1.5 py-0"
            >
              {{ item.badge }}
            </Badge>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </template>
    </SidebarMenu>
  </SidebarGroup>
</template>
