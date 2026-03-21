<script lang="ts">
  import { Sun, Moon } from 'lucide-svelte'
  import { Button } from '$lib/components/ui/button'

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

<Button
  variant="ghost"
  size="icon"
  onclick={toggleTheme}
  class="h-8 w-8"
  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
  {#if isDark}
    <Sun class="h-4 w-4" />
  {:else}
    <Moon class="h-4 w-4" />
  {/if}
</Button>
