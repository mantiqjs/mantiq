<script setup lang="ts">
import { ref } from 'vue'
import { Sun, Moon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const isDark = ref(
  typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false,
)

function toggleTheme() {
  const dark = document.documentElement.classList.toggle('dark')
  localStorage.setItem('theme', dark ? 'dark' : 'light')
  isDark.value = dark
}
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8"
        @click="toggleTheme"
      >
        <Sun v-if="isDark" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ isDark ? 'Light mode' : 'Dark mode' }}</TooltipContent>
  </Tooltip>
</template>
