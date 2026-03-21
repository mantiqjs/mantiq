import { Model } from '@mantiq/database'

export class PersonalAccessToken extends Model {
  static override table = 'personal_access_tokens'
  static override fillable = ['name', 'token', 'abilities', 'expires_at', 'last_used_at', 'tokenable_type', 'tokenable_id']
  static override hidden = ['token']
  static override casts = {
    abilities: 'json' as const,
    last_used_at: 'datetime' as const,
    expires_at: 'datetime' as const,
  }

  can(ability: string): boolean {
    const abilities = this.getAttribute('abilities') as string[] | null
    if (!abilities) return false
    return abilities.includes('*') || abilities.includes(ability)
  }

  cant(ability: string): boolean {
    return !this.can(ability)
  }

  isExpired(): boolean {
    const expiresAt = this.getAttribute('expires_at')
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }
}
