import { Model } from '@mantiq/database'

export class Client extends Model {
  static override table = 'oauth_clients'
  static override keyType = 'string' as const
  static override incrementing = false
  static override guarded = [] as string[]
  static override fillable = [
    'id',
    'name',
    'secret',
    'redirect',
    'personal_access_client',
    'password_client',
  ]
  static override hidden = ['secret']
  static override casts = {
    grant_types: 'json' as const,
    scopes: 'json' as const,
    personal_access_client: 'boolean' as const,
    password_client: 'boolean' as const,
    revoked: 'boolean' as const,
  }

  /**
   * Check if the client is a confidential client (has a secret).
   */
  confidential(): boolean {
    return !!this.getAttribute('secret')
  }

  /**
   * Check if the client is a first-party (personal access) client.
   */
  firstParty(): boolean {
    return !!this.getAttribute('personal_access_client')
  }
}
