import { Model } from '@mantiq/database'

export class RefreshToken extends Model {
  static override table = 'oauth_refresh_tokens'
  static override keyType = 'string' as const
  static override incrementing = false
  static override fillable = [
    'access_token_id',
    'revoked',
    'expires_at',
  ]
  static override casts = {
    revoked: 'boolean' as const,
  }

  /**
   * Revoke the refresh token.
   */
  async revoke(): Promise<void> {
    this.setAttribute('revoked', true)
    await this.save()
  }
}
