import { useState, useEffect } from 'react'
import { post, put, del } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserType {
  id: number
  name: string
  email: string
  status: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Add User Dialog
// ---------------------------------------------------------------------------

export function AddUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setForm({ name: '', email: '', password: '' })
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const { ok, data } = await post('/api/users', form)
      if (!ok) throw new Error(data?.error ?? 'Request failed')
      reset()
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>Create a new user account.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="add-name">Name</Label>
            <Input
              id="add-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-email">Email</Label>
            <Input
              id="add-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-password">Password</Label>
            <Input
              id="add-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Edit User Dialog
// ---------------------------------------------------------------------------

export function EditUserDialog({
  user,
  onOpenChange,
  onSuccess,
}: {
  user: UserType | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Sync form when user changes
  useEffect(() => {
    if (user) {
      setForm({ name: user.name, email: user.email })
      setError('')
    }
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError('')
    try {
      const { ok, data } = await put(`/api/users/${user.id}`, form)
      if (!ok) throw new Error(data?.error ?? 'Request failed')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user details for {user?.name}.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Delete User Dialog
// ---------------------------------------------------------------------------

export function DeleteUserDialog({
  user,
  onOpenChange,
  onSuccess,
}: {
  user: UserType | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleDelete() {
    if (!user) return
    setSubmitting(true)
    setError('')
    try {
      const { ok, data } = await del(`/api/users/${user.id}`)
      if (!ok) throw new Error(data?.error ?? 'Request failed')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={!!user}
      onOpenChange={(v) => {
        if (!v) setError('')
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will permanently delete <span className="font-medium text-foreground">{user?.name}</span>{' '}
            ({user?.email}). This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting}
            onClick={handleDelete}
          >
            {submitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
