<script lang="ts">
  import AccountLayout from './layout.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
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

  let name = $state((() => currentUser?.name ?? '')())
  let email = $state((() => currentUser?.email ?? '')())
  let saving = $state(false)
  let saved = $state(false)

  async function handleSave(e: SubmitEvent) {
    e.preventDefault()
    saving = true
    await new Promise(r => setTimeout(r, 500))
    saving = false
    saved = true
    setTimeout(() => saved = false, 3000)
  }
</script>

<AccountLayout {appName} {currentUser} {navigate} activePath="/account/profile">
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">Profile</h3>
      <p class="text-sm text-muted-foreground">
        This is how others will see you on the site.
      </p>
    </div>
    <form onsubmit={handleSave} class="space-y-6">
      <div class="space-y-2">
        <Label for="name">Name</Label>
        <Input id="name" bind:value={name} />
        <p class="text-xs text-muted-foreground">
          This is your public display name.
        </p>
      </div>
      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input id="email" type="email" bind:value={email} />
        <p class="text-xs text-muted-foreground">
          Your email address is used for notifications.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Update profile'}
        </Button>
        {#if saved}
          <span class="text-sm text-muted-foreground">Saved.</span>
        {/if}
      </div>
    </form>
  </div>
</AccountLayout>
