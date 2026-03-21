<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'

  let {
    open = $bindable(false),
    onSuccess,
  }: {
    open: boolean
    onSuccess: () => void
  } = $props()

  let form = $state({ name: '', email: '', password: '' })
  let error = $state('')
  let submitting = $state(false)

  function reset() {
    form = { name: '', email: '', password: '' }
    error = ''
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    submitting = true
    error = ''
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message ?? `Request failed (${res.status})`)
      }
      reset()
      open = false
      onSuccess()
    } catch (err: any) {
      error = err.message ?? 'Something went wrong'
    } finally {
      submitting = false
    }
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(v) => { if (!v) reset() }}
>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add User</Dialog.Title>
      <Dialog.Description>Create a new user account.</Dialog.Description>
    </Dialog.Header>

    <form onsubmit={handleSubmit} class="grid gap-4 py-2">
      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      <div class="grid gap-2">
        <Label for="add-name">Name</Label>
        <Input
          id="add-name"
          bind:value={form.name}
          required
        />
      </div>

      <div class="grid gap-2">
        <Label for="add-email">Email</Label>
        <Input
          id="add-email"
          type="email"
          bind:value={form.email}
          required
        />
      </div>

      <div class="grid gap-2">
        <Label for="add-password">Password</Label>
        <Input
          id="add-password"
          type="password"
          bind:value={form.password}
          required
        />
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => open = false}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
