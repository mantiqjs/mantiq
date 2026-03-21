<script lang="ts">
  import AccountLayout from './layout.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Card from '$lib/components/ui/card'

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

  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let saving = $state(false)
  let saved = $state(false)
  let error = $state('')

  async function handleSave(e: SubmitEvent) {
    e.preventDefault()
    error = ''
    if (newPassword.length < 8) { error = 'Password must be at least 8 characters.'; return }
    if (newPassword !== confirmPassword) { error = 'Passwords do not match.'; return }
    saving = true
    await new Promise(r => setTimeout(r, 500))
    saving = false
    saved = true
    currentPassword = ''
    newPassword = ''
    confirmPassword = ''
    setTimeout(() => saved = false, 3000)
  }
</script>

<AccountLayout {appName} {currentUser} {navigate} activePath="/account/security">
  <div class="space-y-8">
    <div>
      <h3 class="text-lg font-medium">Security</h3>
      <p class="text-sm text-muted-foreground">
        Manage your password and security settings.
      </p>
    </div>

    <!-- Change Password -->
    <form onsubmit={handleSave} class="space-y-4">
      <div class="space-y-2">
        <Label for="current">Current password</Label>
        <Input id="current" type="password" bind:value={currentPassword} autocomplete="current-password" />
      </div>
      <div class="space-y-2">
        <Label for="new">New password</Label>
        <Input id="new" type="password" bind:value={newPassword} autocomplete="new-password" />
      </div>
      <div class="space-y-2">
        <Label for="confirm">Confirm password</Label>
        <Input id="confirm" type="password" bind:value={confirmPassword} autocomplete="new-password" />
      </div>
      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}
      <div class="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Update password'}
        </Button>
        {#if saved}
          <span class="text-sm text-muted-foreground">Password updated.</span>
        {/if}
      </div>
    </form>

    <!-- 2FA -->
    <div class="space-y-3">
      <div>
        <h4 class="text-sm font-medium">Two-factor authentication</h4>
        <p class="text-sm text-muted-foreground">
          Add an additional layer of security to your account.
        </p>
      </div>
      <Card.Root>
        <Card.Header class="pb-3">
          <Card.Title class="text-sm">Authenticator app</Card.Title>
          <Card.Description>
            Use an authenticator app to generate one-time codes.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Button variant="outline" disabled>Enable 2FA</Button>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Delete Account -->
    <div class="space-y-3">
      <div>
        <h4 class="text-sm font-medium">Delete account</h4>
        <p class="text-sm text-muted-foreground">
          Permanently remove your account and all associated data. This action cannot be undone.
        </p>
      </div>
      <Button variant="destructive" disabled>Delete account</Button>
    </div>
  </div>
</AccountLayout>
