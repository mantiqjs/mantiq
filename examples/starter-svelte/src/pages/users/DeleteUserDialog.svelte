<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'

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

  let error = $state('')
  let submitting = $state(false)

  async function handleDelete() {
    if (!user) return
    submitting = true
    error = ''
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
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
  onOpenChange={(v) => { if (!v) { error = ''; user = null } }}
>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Are you sure?</Dialog.Title>
      <Dialog.Description>
        This will permanently delete <span class="font-medium text-foreground">{user?.name}</span>
        ({user?.email}). This action cannot be undone.
      </Dialog.Description>
    </Dialog.Header>

    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}

    <Dialog.Footer>
      <Button type="button" variant="outline" onclick={() => user = null}>
        Cancel
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={submitting}
        onclick={handleDelete}
      >
        {submitting ? 'Deleting...' : 'Delete'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
