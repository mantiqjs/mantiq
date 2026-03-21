<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AccountLayout from './layout.vue'
import { Button } from '@/components/ui/button'
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

const theme = ref<'light' | 'dark' | 'system'>('system')
const success = ref('')

onMounted(() => {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    theme.value = stored
  } else {
    theme.value = 'system'
  }
})

function setTheme(value: 'light' | 'dark' | 'system') {
  theme.value = value
  if (value === 'system') {
    localStorage.removeItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', prefersDark)
  } else {
    localStorage.setItem('theme', value)
    document.documentElement.classList.toggle('dark', value === 'dark')
  }
  success.value = 'Preferences saved.'
}
</script>

<template>
  <AccountLayout
    :app-name="appName"
    :current-user="currentUser"
    :navigate="navigate"
    active-path="/account/preferences"
    title="Settings"
    description="Manage your account settings."
  >
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Customize your experience.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          v-if="success"
          class="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400"
        >
          {{ success }}
        </div>
        <div class="space-y-4 max-w-md">
          <div class="space-y-2">
            <Label>Theme</Label>
            <div class="flex gap-2">
              <Button
                v-for="opt in (['light', 'dark', 'system'] as const)"
                :key="opt"
                :variant="theme === opt ? 'default' : 'outline'"
                size="sm"
                @click="setTheme(opt)"
              >
                {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </AccountLayout>
</template>
