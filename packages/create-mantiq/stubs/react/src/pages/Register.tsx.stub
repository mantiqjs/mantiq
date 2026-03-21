import { useState } from 'react'
import { post } from '../lib/api.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RegisterProps {
  appName?: string
  navigate: (href: string) => void
  [key: string]: any
}

export default function Register({ appName = 'Mantiq', navigate }: RegisterProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { ok, data } = await post('/register', { name, email, password })
    if (ok) navigate('/dashboard')
    else setError(data?.error?.message ?? data?.error ?? 'Registration failed. Please try again.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-foreground text-background flex-col justify-between p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-background text-foreground text-xs font-bold">
            M
          </div>
          <span className="text-lg font-semibold tracking-tight">{appName}</span>
        </div>

        <div>
          <blockquote className="text-2xl font-medium leading-snug tracking-tight">
            "The framework that gets out of your way."
          </blockquote>
        </div>

        <p className="text-sm text-background/50">
          &copy; {new Date().getFullYear()} {appName}. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile-only logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-foreground text-background text-xs font-bold">
            M
          </div>
          <span className="text-lg font-semibold tracking-tight">{appName}</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started with {appName} today
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-destructive px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Create a strong password"
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-4"
              onClick={() => navigate('/login')}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
