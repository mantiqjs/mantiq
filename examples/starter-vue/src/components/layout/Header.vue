<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout'
import SearchDialog from '@/components/layout/SearchDialog.vue'
import { Search } from 'lucide-vue-next'

const props = defineProps<{
  fixed?: boolean
  class?: string
  navigate?: (href: string) => void
}>()

const offset = ref(0)
const searchOpen = ref(false)

function onScroll() {
  offset.value = document.body.scrollTop || document.documentElement.scrollTop
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    searchOpen.value = true
  }
}

function handleNavigate(href: string) {
  if (props.navigate) {
    props.navigate(href)
  } else {
    window.location.href = href
  }
}

onMounted(() => {
  document.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('scroll', onScroll)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <header
    :class="cn(
      'flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12',
      fixed && 'sticky top-0 z-10 bg-background',
      offset > 10 && fixed ? 'border-b' : '',
      props.class,
    )"
  >
    <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
      <SidebarTrigger class="-ml-1" />
      <Separator orientation="vertical" class="mx-2 h-4" />
      <slot />
      <div class="ms-auto flex items-center gap-2">
        <Button
          variant="outline"
          class="relative h-8 w-full justify-start rounded-md text-sm text-muted-foreground sm:w-40 lg:w-64"
          @click="searchOpen = true"
        >
          <Search class="mr-2 h-4 w-4" />
          Search...
          <kbd class="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
            <span class="text-xs">&#x2318;</span>K
          </kbd>
        </Button>
        <ThemeToggle />
      </div>
    </div>
  </header>
  <SearchDialog v-model:open="searchOpen" :navigate="handleNavigate" />
</template>
