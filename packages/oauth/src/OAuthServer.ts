export interface OAuthConfig {
  /**
   * Lifetime of access tokens in seconds.
   * @default 3600 (1 hour)
   */
  tokenLifetime?: number

  /**
   * Lifetime of refresh tokens in seconds.
   * @default 1209600 (14 days)
   */
  refreshTokenLifetime?: number

  /**
   * Path to the RSA private key PEM file.
   */
  privateKeyPath?: string

  /**
   * Path to the RSA public key PEM file.
   */
  publicKeyPath?: string
}

/**
 * Central OAuth server configuration holder.
 * Manages scopes and token lifetimes.
 */
export class OAuthServer {
  private _scopes = new Map<string, string>()

  constructor(private config: OAuthConfig) {}

  get tokenLifetime(): number {
    return this.config.tokenLifetime ?? 3600
  }

  get refreshTokenLifetime(): number {
    return this.config.refreshTokenLifetime ?? 1209600
  }

  get privateKeyPath(): string {
    return this.config.privateKeyPath ?? 'storage/oauth-private.key'
  }

  get publicKeyPath(): string {
    return this.config.publicKeyPath ?? 'storage/oauth-public.key'
  }

  /**
   * Register scopes that tokens can be issued with.
   */
  tokensCan(scopes: Record<string, string>): void {
    for (const [id, description] of Object.entries(scopes)) {
      this._scopes.set(id, description)
    }
  }

  /**
   * Check if a scope is registered.
   */
  hasScope(scope: string): boolean {
    return this._scopes.has(scope)
  }

  /**
   * Get all registered scopes.
   */
  scopes(): Array<{ id: string; description: string }> {
    return Array.from(this._scopes.entries()).map(([id, description]) => ({
      id,
      description,
    }))
  }
}
