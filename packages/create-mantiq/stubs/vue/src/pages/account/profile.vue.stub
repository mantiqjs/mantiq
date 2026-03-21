<script setup lang="ts">
import { ref } from 'vue'
import { post } from '@/lib/api'
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

const name = ref(props.currentUser?.name ?? '')
const email = ref(props.currentUser?.email ?? '')
const success = ref('')
const error = ref('')

async function handleSubmit() {
  success.value = ''
  error.value = ''
  // Profile update would call an API endpoint
  success.value = 'Profile updated successfully.'
}
</script>

<template>
  <AccountLayout
    :app-name="appName"
    :current-user="currentUser"
    :navigate="navigate"
    active-path="/account/profile"
    title="Settings"
    description="Manage your account settings."
  >
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your personal information.</CardDescription>
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
            <Label for="profile-name">Name</Label>
            <Input id="profile-name" v-model="name" required />
          </div>
          <div class="space-y-2">
            <Label for="profile-email">Email</Label>
            <Input id="profile-email" v-model="email" type="email" required />
          </div>
          <Button type="submit">Save Changes</Button>
        </form>
      </CardContent>
    </Card>
  </AccountLayout>
</template>
