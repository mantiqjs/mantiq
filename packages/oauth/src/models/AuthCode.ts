import { Model } from '@mantiq/database'

export class AuthCode extends Model {
  static override table = 'oauth_auth_codes'
  static override keyType = 'string' as const
  static override incrementing = false
  static override guarded = [] as string[]
  static override fillable = [
    'id',
    'user_id',
    'client_id',
    'scopes',
    'revoked',
    'expires_at',
    'code_challenge',
    'code_challenge_method',
  ]
  static override casts = {
    scopes: 'json' as const,
    revoked: 'boolean' as const,
  }
}
