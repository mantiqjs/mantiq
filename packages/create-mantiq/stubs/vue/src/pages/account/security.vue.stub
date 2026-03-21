<script setup lang="ts">
import { ref } from 'vue'
import AccountLayout from './layout.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const props = withDefaults(defineProps<{
  appName?: string
  currentUser?: { name: string; email: string; role?: string } | null
  navigate: (href: string) => void
}>(), {
  appName: 'Mantiq',
})

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const success = ref('')
const error = ref('')

async function handleSubmit() {
  success.value = ''
  error.value = ''
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }
  if (newPassword.value.length < 6) {
    error.value = 'Password must be at least 6 characters.'
    return
  }
  // Password change would call an API endpoint
  success.value = 'Password updated successfully.'
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}
</script>

<template>
  <AccountLayout
    :app-name="appName"
    :current-user="currentUser"
    :navigate="navigate"
    active-path="/account/security"
    title="Settings"
    description="Manage your account settings."
  >
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>Change your password.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          v-if="success"
          class="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400"
        >
          {{ success }}
        </div>
        <div
          v-if="error"
          class="mb-4 rounded-md border border-destructive px-4 py-3 text-sm text-destructive"
        >
          {{ error }}
        </div>
        <form class="space-y-4 max-w-md" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="current-password">Current Password</Label>
            <Input id="current-password" v-model="currentPassword" type="password" required />
          </div>
          <div class="space-y-2">
            <Label for="new-password">New Password</Label>
            <Input id="new-password" v-model="newPassword" type="password" required placeholder="Min 6 characters" />
          </div>
          <div class="space-y-2">
            <Label for="confirm-password">Confirm New Password</Label>
            <Input id="confirm-password" v-model="confirmPassword" type="password" required />
          </div>
          <Button type="submit">Update Password</Button>
        </form>
      </CardContent>
    </Card>
  </AccountLayout>
</template>
