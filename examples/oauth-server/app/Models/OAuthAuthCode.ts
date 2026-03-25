import { Model } from '@mantiq/database'

export class OAuthAuthCode extends Model {
  static override table = 'oauth_auth_codes'
  static override fillable = [
    'code', 'client_id', 'user_id', 'scopes', 'redirect_uri',
    'code_challenge', 'code_challenge_method', 'expires_at', 'revoked',
  ]
  static override guarded = ['id']
  static override timestamps = true
  static override casts = {
    scopes: 'json',
    expires_at: 'datetime',
  } as const
}
