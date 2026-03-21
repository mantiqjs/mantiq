<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Home,
  Users,
  User,
  Lock,
  Palette,
  BookOpen,
  Github,
  FileText,
  ArrowRight,
} from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  navigate: (href: string) => void
}>()

const open = defineModel<boolean>('open', { default: false })

const query = ref('')
const selected = ref(0)

const pages = [
  { title: 'Dashboard', url: '/dashboard', icon: Home, group: 'Pages', external: false },
  { title: 'Users', url: '/users', icon: Users, group: 'Pages', external: false },
  { title: 'Profile', url: '/account/profile', icon: User, group: 'Settings', external: false },
  { title: 'Security', url: '/account/security', icon: Lock, group: 'Settings', external: false },
  { title: 'Preferences', url: '/account/preferences', icon: Palette, group: 'Settings', external: false },
  { title: 'Documentation', url: 'https://github.com/mantiqjs/mantiq#readme', icon: BookOpen, group: 'Links', external: true },
  { title: 'GitHub', url: 'https://github.com/mantiqjs/mantiq', icon: Github, group: 'Links', external: true },
]

const filtered = computed(() =>
  query.value.trim()
    ? pages.filter(p => p.title.toLowerCase().includes(query.value.toLowerCase()))
    : pages,
)

const groups = computed(() => [...new Set(filtered.value.map(p => p.group))])

watch(query, () => {
  selected.value = 0
})

function handleSelect(item: (typeof pages)[number]) {
  open.value = false
  query.value = ''
  if (item.external) {
    window.open(item.url, '_blank')
  } else {
    props.navigate(item.url)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selected.value = Math.min(selected.value + 1, filtered.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selected.value = Math.max(selected.value - 1, 0)
  } else if (e.key === 'Enter' && filtered.value[selected.value]) {
    e.preventDefault()
    handleSelect(filtered.value[selected.value])
  }
}

function getGlobalIndex(group: string): number {
  const items = filtered.value.filter(p => p.group === group)
  if (!items.length) return 0
  return filtered.value.indexOf(items[0])
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="overflow-hidden p-0 gap-0 sm:max-w-[480px]">
      <div class="flex items-center border-b px-3">
        <FileText class="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          v-model="query"
          placeholder="Type a command or search..."
          class="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          autofocus
          @keydown="handleKeyDown"
        />
      </div>
      <div class="max-h-[300px] overflow-y-auto p-2">
        <p
          v-if="filtered.length === 0"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          No results found.
        </p>
        <div v-for="group in groups" :key="group">
          <p class="px-2 py-1.5 text-xs font-medium text-muted-foreground">{{ group }}</p>
          <button
            v-for="(item, i) in filtered.filter(p => p.group === group)"
            :key="item.url"
            class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors"
            :class="getGlobalIndex(group) + i === selected ? 'bg-accent text-accent-foreground' : 'text-foreground'"
            @click="handleSelect(item)"
          >
            <component :is="item.icon" class="h-4 w-4 text-muted-foreground" />
            <span class="flex-1 text-left">{{ item.title }}</span>
            <ArrowRight
              v-if="getGlobalIndex(group) + i === selected"
              class="h-3 w-3 text-muted-foreground"
            />
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
