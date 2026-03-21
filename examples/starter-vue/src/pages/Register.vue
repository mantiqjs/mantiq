<script setup lang="ts">
import { ref } from 'vue'
import { post } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = withDefaults(defineProps<{
  appName?: string
  navigate: (href: string) => void
}>(), {
  appName: 'Mantiq',
})

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  const { ok, data } = await post('/register', {
    name: name.value,
    email: email.value,
    password: password.value,
  })
  if (ok) props.navigate('/dashboard')
  else error.value = data?.error?.message ?? data?.error ?? 'Registration failed'
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex bg-background">
    <!-- Left brand panel -->
    <div class="hidden lg:flex lg:w-[45%] bg-foreground text-background flex-col justify-between p-10">
      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 items-center justify-center rounded bg-background text-foreground text-xs font-bold">
          M
        </div>
        <span class="text-lg font-semibold tracking-tight">{{ appName }}</span>
      </div>

      <div>
        <blockquote class="text-2xl font-medium leading-snug tracking-tight">
          "The framework that gets out of your way."
        </blockquote>
      </div>

      <p class="text-sm text-background/50">
        &copy; {{ new Date().getFullYear() }} {{ appName }}. All rights reserved.
      </p>
    </div>

    <!-- Right form panel -->
    <div class="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <!-- Mobile-only logo -->
      <div class="mb-10 flex items-center gap-3 lg:hidden">
        <div class="flex h-8 w-8 items-center justify-center rounded bg-foreground text-background text-xs font-bold">
          M
        </div>
        <span class="text-lg font-semibold tracking-tight">{{ appName }}</span>
      </div>

      <div class="w-full max-w-sm">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p class="mt-2 text-sm text-muted-foreground">
            Get started with {{ appName }}
          </p>
        </div>

        <div
          v-if="error"
          class="mb-6 rounded-md border border-destructive px-4 py-3 text-sm text-destructive"
        >
          {{ error }}
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input
              id="name"
              v-model="name"
              required
              placeholder="Your name"
              autocomplete="name"
            />
          </div>
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              required
              placeholder="you@example.com"
              autocomplete="email"
            />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              required
              placeholder="Create a password"
              autocomplete="new-password"
            />
          </div>
          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Creating account...' : 'Create account' }}
          </Button>
        </form>

        <p class="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?
          <button
            type="button"
            class="font-medium text-foreground underline underline-offset-4"
            @click="navigate('/login')"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  </div>
</template>
