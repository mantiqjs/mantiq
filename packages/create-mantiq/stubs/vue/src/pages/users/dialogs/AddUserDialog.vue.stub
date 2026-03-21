<script setup lang="ts">
import { ref } from 'vue'
import { post } from '@/lib/api'
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

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

function reset() {
  name.value = ''
  email.value = ''
  password.value = ''
  error.value = ''
}

async function handleSubmit() {
  error.value = ''
  loading.value = true
  const { ok, data } = await post('/api/users', {
    name: name.value,
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (ok) {
    open.value = false
    reset()
    emit('created')
  } else {
    error.value = data?.error ?? 'Failed to create user.'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Add User</DialogTitle>
        <DialogDescription>Create a new user account.</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div
          v-if="error"
          class="rounded-md border border-destructive px-4 py-3 text-sm text-destructive"
        >
          {{ error }}
        </div>
        <div class="space-y-2">
          <Label for="add-name">Name</Label>
          <Input id="add-name" v-model="name" required placeholder="Full name" />
        </div>
        <div class="space-y-2">
          <Label for="add-email">Email</Label>
          <Input id="add-email" v-model="email" type="email" required placeholder="user@example.com" />
        </div>
        <div class="space-y-2">
          <Label for="add-password">Password</Label>
          <Input id="add-password" v-model="password" type="password" required placeholder="Min 6 characters" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">Cancel</Button>
          <Button type="submit" :disabled="loading">
            {{ loading ? 'Creating...' : 'Create User' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
