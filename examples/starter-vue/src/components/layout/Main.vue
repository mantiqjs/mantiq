<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{
  fixed?: boolean
  class?: string
}>()
</script>

<template>
  <main
    :class="cn(
      'peer-[.header-fixed]/header:mt-16',
      fixed && 'flex flex-grow flex-col overflow-hidden',
      props.class,
    )"
  >
    <div class="px-4 py-6 lg:px-6">
      <slot />
    </div>
  </main>
</template>
