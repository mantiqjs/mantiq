<script lang="ts">
  import AccountLayout from './layout.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'

  let {
    appName,
    currentUser = null,
    navigate,
  }: {
    appName?: string
    currentUser?: { id: number; name: string; email: string } | null
    navigate: (href: string) => void
    [key: string]: any
  } = $props()

  let theme = $state<'light' | 'dark' | 'system'>(
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem('theme') as any) ?? 'system'
      : 'system'
  )

  function applyTheme(t: 'light' | 'dark' | 'system') {
    theme = t
    if (t === 'system') {
      localStorage.removeItem('theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    } else {
      localStorage.setItem('theme', t)
      document.documentElement.classList.toggle('dark', t === 'dark')
    }
  }

  const themes: { value: 'light' | 'dark' | 'system'; label: string; description: string }[] = [
    { value: 'light', label: 'Light', description: 'A clean, bright appearance.' },
    { value: 'dark', label: 'Dark', description: 'Easy on the eyes in low light.' },
    { value: 'system', label: 'System', description: 'Follows your operating system setting.' },
  ]
</script>

<AccountLayout {appName} {currentUser} {navigate} activePath="/account/preferences">
  <div class="space-y-8">
    <div>
      <h3 class="text-lg font-medium">Preferences</h3>
      <p class="text-sm text-muted-foreground">
        Customize the appearance and behavior of the app.
      </p>
    </div>

    <!-- Theme -->
    <div class="space-y-3">
      <Label>Theme</Label>
      <p class="text-sm text-muted-foreground">Select your preferred theme.</p>
      <div class="grid grid-cols-3 gap-3">
        {#each themes as t}
          <button
            type="button"
            onclick={() => applyTheme(t.value)}
            class="rounded-lg border p-4 text-left text-sm transition-colors hover:bg-accent {theme === t.value ? 'border-foreground' : 'border-border'}"
          >
            <div class="font-medium">{t.label}</div>
            <div class="text-xs text-muted-foreground mt-1">{t.description}</div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Language -->
    <div class="space-y-3">
      <Label>Language</Label>
      <p class="text-sm text-muted-foreground">Select the language for the interface.</p>
      <Button variant="outline" disabled class="justify-between w-48">
        English
        <span class="text-xs text-muted-foreground">Default</span>
      </Button>
    </div>
  </div>
</AccountLayout>
