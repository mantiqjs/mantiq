import { Model } from '@mantiq/database'

export class OAuthAccessToken extends Model {
  static override table = 'oauth_access_tokens'
  static override fillable = [
    'token', 'client_id', 'user_id', 'scopes', 'expires_at', 'revoked',
  ]
  static override guarded = ['id']
  static override hidden = ['token']
  static override timestamps = true
  static override casts = {
    scopes: 'json',
    expires_at: 'datetime',
  } as const
}
