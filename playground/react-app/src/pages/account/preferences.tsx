import { useState } from 'react'
import { AccountLayout } from './layout.tsx'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface PreferencesProps {
  appName?: string
  currentUser?: { id: number; name: string; email: string } | null
  navigate: (href: string) => void
  [key: string]: any
}

export default function Preferences({ appName, currentUser, navigate }: PreferencesProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof localStorage === 'undefined') return 'system'
    return (localStorage.getItem('theme') as any) ?? 'system'
  })

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    setTheme(t)
    if (t === 'system') {
      localStorage.removeItem('theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    } else {
      localStorage.setItem('theme', t)
      document.documentElement.classList.toggle('dark', t === 'dark')
    }
  }

  const themes = [
    { value: 'light' as const, label: 'Light', description: 'A clean, bright appearance.' },
    { value: 'dark' as const, label: 'Dark', description: 'Easy on the eyes in low light.' },
    { value: 'system' as const, label: 'System', description: 'Follows your operating system setting.' },
  ]

  return (
    <AccountLayout appName={appName} currentUser={currentUser} navigate={navigate} activePath="/account/preferences">
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium">Preferences</h3>
          <p className="text-sm text-muted-foreground">
            Customize the appearance and behavior of the app.
          </p>
        </div>

        {/* Theme */}
        <div className="space-y-3">
          <Label>Theme</Label>
          <p className="text-sm text-muted-foreground">Select your preferred theme.</p>
          <div className="grid grid-cols-3 gap-3">
            {themes.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => applyTheme(t.value)}
                className={`rounded-lg border p-4 text-left text-sm transition-colors hover:bg-accent ${
                  theme === t.value ? 'border-foreground' : 'border-border'
                }`}
              >
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="space-y-3">
          <Label>Language</Label>
          <p className="text-sm text-muted-foreground">Select the language for the interface.</p>
          <Button variant="outline" disabled className="justify-between w-48">
            English
            <span className="text-xs text-muted-foreground">Default</span>
          </Button>
        </div>
      </div>
    </AccountLayout>
  )
}
