<script setup lang="ts">
import { ref, watch } from 'vue'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{
  user: { id: number; name: string; email: string } | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ updated: [] }>()

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

watch(() => props.user, (u) => {
  if (u) {
    name.value = u.name
    email.value = u.email
    password.value = ''
    error.value = ''
  }
})

async function handleSubmit() {
  if (!props.user) return
  error.value = ''
  loading.value = true
  const body: Record<string, string> = { name: name.value, email: email.value }
  if (password.value) body.password = password.value
  const { ok, data } = await api(`/api/users/${props.user.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  loading.value = false
  if (ok) {
    open.value = false
    emit('updated')
  } else {
    error.value = data?.error ?? 'Failed to update user.'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Edit User</DialogTitle>
        <DialogDescription>Update user information.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div
          v-if="error"
          class="rounded-md border border-destructive px-4 py-3 text-sm text-destructive"
        >
          {{ error }}
        </div>
        <div class="space-y-2">
          <Label for="edit-name">Name</Label>
          <Input id="edit-name" v-model="name" required placeholder="Full name" />
        </div>
        <div class="space-y-2">
          <Label for="edit-email">Email</Label>
          <Input id="edit-email" v-model="email" type="email" required placeholder="user@example.com" />
        </div>
        <div class="space-y-2">
          <Label for="edit-password">Password</Label>
          <Input id="edit-password" v-model="password" type="password" placeholder="Leave blank to keep current" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">Cancel</Button>
          <Button type="submit" :disabled="loading">
            {{ loading ? 'Saving...' : 'Save Changes' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
