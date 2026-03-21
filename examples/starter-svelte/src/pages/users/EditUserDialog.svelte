<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'

  interface UserType {
    id: number
    name: string
    email: string
    status: string
    created_at: string
  }

  let {
    user = $bindable(null),
    onSuccess,
  }: {
    user: UserType | null
    onSuccess: () => void
  } = $props()

  let form = $state({ name: '', email: '' })
  let error = $state('')
  let submitting = $state(false)

  // Sync form when user changes
  $effect(() => {
    if (user) {
      form = { name: user.name, email: user.email }
      error = ''
    }
  })

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!user) return
    submitting = true
    error = ''
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message ?? `Request failed (${res.status})`)
      }
      user = null
      onSuccess()
    } catch (err: any) {
      error = err.message ?? 'Something went wrong'
    } finally {
      submitting = false
    }
  }
</script>

<Dialog.Root
  open={!!user}
  onOpenChange={(v) => { if (!v) user = null }}
>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Edit User</Dialog.Title>
      <Dialog.Description>Update user details for {user?.name}.</Dialog.Description>
    </Dialog.Header>

    <form onsubmit={handleSubmit} class="grid gap-4 py-2">
      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      <div class="grid gap-2">
        <Label for="edit-name">Name</Label>
        <Input
          id="edit-name"
          bind:value={form.name}
          required
        />
      </div>

      <div class="grid gap-2">
        <Label for="edit-email">Email</Label>
        <Input
          id="edit-email"
          type="email"
          bind:value={form.email}
          required
        />
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => user = null}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
