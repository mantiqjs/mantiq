import { Model } from '@mantiq/database'

export class AccessToken extends Model {
  static override table = 'oauth_access_tokens'
  static override keyType = 'string' as const
  static override incrementing = false
  static override guarded = [] as string[]
  static override fillable = [
    'id',
    'user_id',
    'client_id',
    'name',
    'scopes',
    'revoked',
    'expires_at',
  ]
  static override casts = {
    scopes: 'json' as const,
    revoked: 'boolean' as const,
  }

  /**
   * Check if the token has the given scope.
   */
  can(scope: string): boolean {
    const scopes = this.getAttribute('scopes') as string[] | null
    if (!scopes) return false
    return scopes.includes('*') || scopes.includes(scope)
  }

  /**
   * Check if the token does NOT have the given scope.
   */
  cant(scope: string): boolean {
    return !this.can(scope)
  }

  /**
   * Revoke the access token.
   */
  async revoke(): Promise<void> {
    this.setAttribute('revoked', true)
    await this.save()
  }

  /**
   * Check if the token has expired.
   */
  isExpired(): boolean {
    const expiresAt = this.getAttribute('expires_at')
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }
}
