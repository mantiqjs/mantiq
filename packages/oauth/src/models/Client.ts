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

  /**
   * Hash the client secret before storing it.
   * Should be called when creating or updating the client secret.
   *
   * Uses Bun.password.hash with bcrypt for secure one-way hashing.
   * The plaintext secret is returned so it can be shown to the user once.
   */
  static async hashSecret(plaintext: string): Promise<string> {
    return await Bun.password.hash(plaintext, { algorithm: 'bcrypt', cost: 10 })
  }

  /**
   * Verify a plaintext secret against the stored hash.
   *
   * Uses Bun.password.verify for constant-time comparison against the
   * bcrypt hash. Returns false if the secret is empty or null.
   */
  async verifySecret(plaintext: string): Promise<boolean> {
    const storedHash = this.getAttribute('secret') as string | null
    // Security: reject if no secret is stored (public client)
    if (!storedHash || !plaintext) return false
    return await Bun.password.verify(plaintext, storedHash)
  }
}
