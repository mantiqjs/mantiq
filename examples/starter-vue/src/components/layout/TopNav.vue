<script setup lang="ts">
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-vue-next'

export interface TopNavLink {
  title: string
  href: string
  isActive?: boolean
  disabled?: boolean
}

const props = defineProps<{
  links: TopNavLink[]
  class?: string
}>()

const emit = defineEmits<{
  linkClick: [href: string]
}>()

function handleClick(e: MouseEvent, href: string) {
  e.preventDefault()
  emit('linkClick', href)
}
</script>

<template>
  <!-- Desktop navigation -->
  <nav
    :class="cn('hidden items-center gap-4 md:flex lg:gap-6', props.class)"
  >
    <a
      v-for="link in links"
      :key="link.href"
      :href="link.href"
      :class="cn(
        'text-sm font-medium transition-colors hover:text-primary',
        link.isActive ? 'text-foreground' : 'text-muted-foreground',
        link.disabled && 'pointer-events-none opacity-50',
      )"
      @click="handleClick($event, link.href)"
    >
      {{ link.title }}
    </a>
  </nav>

  <!-- Mobile navigation -->
  <div class="md:hidden">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="icon" class="h-8 w-8">
          <Menu class="h-4 w-4" />
          <span class="sr-only">Toggle navigation</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          v-for="link in links"
          :key="link.href"
          :disabled="link.disabled"
          @select="emit('linkClick', link.href)"
        >
          <span :class="cn(!link.isActive && 'text-muted-foreground')">
            {{ link.title }}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
