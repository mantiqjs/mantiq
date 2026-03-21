<script lang="ts">
  import { Sun, Moon } from 'lucide-svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Tooltip from '$lib/components/ui/tooltip'

  let isDark = $state(
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  )

  function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    isDark = dark
  }
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Button
        variant="ghost"
        size="icon"
        onclick={toggleTheme}
        class="h-8 w-8"
        {...props}
      >
        {#if isDark}
          <Sun class="h-4 w-4" />
        {:else}
          <Moon class="h-4 w-4" />
        {/if}
        <span class="sr-only">Toggle theme</span>
      </Button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>{isDark ? 'Light mode' : 'Dark mode'}</Tooltip.Content>
</Tooltip.Root>
