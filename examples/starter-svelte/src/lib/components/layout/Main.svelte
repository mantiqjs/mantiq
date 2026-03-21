<script lang="ts">
  import { cn } from '$lib/utils'
  import type { Snippet } from 'svelte'

  let {
    fixed = false,
    class: className,
    children,
  }: {
    fixed?: boolean
    class?: string
    children: Snippet
  } = $props()
</script>

<main
  class={cn(
    'peer-[.header-fixed]/header:mt-16',
    fixed && 'flex flex-grow flex-col overflow-hidden',
    className,
  )}
>
  <div class="px-4 py-6 lg:px-6">
    {@render children()}
  </div>
</main>
