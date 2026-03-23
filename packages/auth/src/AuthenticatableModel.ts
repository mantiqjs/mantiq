import type { Authenticatable } from './contracts/Authenticatable.ts'
import { applyHasApiTokens } from './HasApiTokens.ts'

/** Minimum interface a base class must have for the mixin to work. */
interface ModelLike {
  getAttribute(key: string): any
  setAttribute(key: string, value: any): any
  toObject(): Record<string, any>
  getKey(): string | number
}

// Accept both abstract and concrete constructors
type AbstractConstructor<T = any> = abstract new (...args: any[]) => T

interface TokenMethods {
  createToken(name: string, abilities?: string[], expiresAt?: Date): Promise<{ accessToken: any; plainTextToken: string }>
  tokens(): any
  currentAccessToken(): any
  tokenCan(ability: string): boolean
  tokenCant(ability: string): boolean
}

/**
 * Mixin that adds Authenticatable + HasApiTokens to any Model class.
 *
 * Provides default implementations for conventional column names:
 *   - id (primary key)
 *   - password (hashed password)
 *   - remember_token (remember me token)
 *
 * Also adds token methods: createToken(), tokens(), tokenCan(), tokenCant()
 *
 * Usage:
 *   import { AuthenticatableModel } from '@mantiq/auth'
 *   import { Model } from '@mantiq/database'
 *
 *   export class User extends AuthenticatableModel(Model) {
 *     static override fillable = ['name', 'email', 'password']
 *     static override hidden = ['password', 'remember_token']
 *   }
 */
export function AuthenticatableModel<T extends AbstractConstructor<ModelLike>>(Base: T) {
  abstract class AuthModel extends Base implements Authenticatable {
    getAuthIdentifierName(): string { return 'id' }
    getAuthIdentifier(): string | number { return this.getAttribute('id') }
    getAuthPasswordName(): string { return 'password' }
    getAuthPassword(): string { return this.getAttribute('password') as string }
    getRememberToken(): string | null { return (this.getAttribute('remember_token') as string) ?? null }
    setRememberToken(token: string | null): void { this.setAttribute('remember_token', token) }
    getRememberTokenName(): string { return 'remember_token' }

    declare createToken: TokenMethods['createToken']
    declare tokens: TokenMethods['tokens']
    declare currentAccessToken: TokenMethods['currentAccessToken']
    declare tokenCan: TokenMethods['tokenCan']
    declare tokenCant: TokenMethods['tokenCant']
  }

  applyHasApiTokens(AuthModel)

  return AuthModel as AbstractConstructor<Authenticatable & TokenMethods> & T
}
