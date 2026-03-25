import { Model } from '@mantiq/database'

export class OAuthClient extends Model {
  static override table = 'oauth_clients'
  static override fillable = [
    'name', 'client_id', 'client_secret', 'redirect_uris', 'grant_types',
    'scopes', 'user_id', 'is_confidential', 'is_active',
  ]
  static override guarded = ['id']
  static override hidden = ['client_secret']
  static override timestamps = true
  static override casts = {
    redirect_uris: 'json',
    grant_types: 'json',
    scopes: 'json',
  } as const
}
