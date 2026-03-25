import { Model } from '@mantiq/database'

export class OAuthRefreshToken extends Model {
  static override table = 'oauth_refresh_tokens'
  static override fillable = [
    'token', 'access_token_id', 'expires_at', 'revoked',
  ]
  static override guarded = ['id']
  static override hidden = ['token']
  static override timestamps = true
  static override casts = {
    expires_at: 'datetime',
  } as const
}
