<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
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
const emit = defineEmits<{ deleted: [] }>()

const loading = ref(false)
const error = ref('')

async function handleDelete() {
  if (!props.user) return
  error.value = ''
  loading.value = true
  const { ok, data } = await api(`/api/users/${props.user.id}`, { method: 'DELETE' })
  loading.value = false
  if (ok) {
    open.value = false
    emit('deleted')
  } else {
    error.value = data?.error ?? 'Failed to delete user.'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Delete User</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete <strong>{{ user?.name }}</strong>? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <div
        v-if="error"
        class="rounded-md border border-destructive px-4 py-3 text-sm text-destructive"
      >
        {{ error }}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">Cancel</Button>
        <Button variant="destructive" :disabled="loading" @click="handleDelete">
          {{ loading ? 'Deleting...' : 'Delete User' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
