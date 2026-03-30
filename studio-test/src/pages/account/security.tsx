import { useState } from 'react'
import { AccountLayout } from './layout.tsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SecurityProps {
  appName?: string
  currentUser?: { id: number; name: string; email: string } | null
  navigate: (href: string) => void
  [key: string]: any
}

export default function Security({ appName, currentUser, navigate }: SecurityProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setSaving(true)
    await new Promise(r => setTimeout(r, 500))
    setSaving(false)
    setSaved(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <AccountLayout appName={appName} currentUser={currentUser} navigate={navigate} activePath="/account/security">
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium">Security</h3>
          <p className="text-sm text-muted-foreground">
            Manage your password and security settings.
          </p>
        </div>

        {/* Change Password */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new">New password</Label>
            <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Update password'}
            </Button>
            {saved && <span className="text-sm text-muted-foreground">Password updated.</span>}
          </div>
        </form>

        {/* 2FA */}
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">Two-factor authentication</h4>
            <p className="text-sm text-muted-foreground">
              Add an additional layer of security to your account.
            </p>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Authenticator app</CardTitle>
              <CardDescription>
                Use an authenticator app to generate one-time codes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" disabled>Enable 2FA</Button>
            </CardContent>
          </Card>
        </div>

        {/* Delete Account */}
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">Delete account</h4>
            <p className="text-sm text-muted-foreground">
              Permanently remove your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <Button variant="destructive" disabled>Delete account</Button>
        </div>
      </div>
    </AccountLayout>
  )
}
