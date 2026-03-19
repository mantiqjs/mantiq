import type { Authenticatable } from './Authenticatable.ts'

/**
 * Contract for user retrieval and credential validation.
 * Each provider implementation resolves users from a different source.
 */
export interface UserProvider {
  /** Retrieve a user by their unique identifier. */
  retrieveById(identifier: string | number): Promise<Authenticatable | null>

  /** Retrieve a user by their identifier and remember token. */
  retrieveByToken(identifier: string | number, token: string): Promise<Authenticatable | null>

  /** Update the remember me token on the user. */
  updateRememberToken(user: Authenticatable, token: string): Promise<void>

  /** Retrieve a user by credentials (e.g. email). Does NOT check password. */
  retrieveByCredentials(credentials: Record<string, any>): Promise<Authenticatable | null>

  /** Validate a user against the given credentials (checks password). */
  validateCredentials(user: Authenticatable, credentials: Record<string, any>): Promise<boolean>

  /** Re-hash the password if the hasher's cost has changed. */
  rehashPasswordIfRequired(user: Authenticatable, credentials: Record<string, any>): Promise<void>
}
