/**
 * Contract for authenticatable entities (typically the User model).
 *
 * Implement this interface on your Model subclass. For conventional
 * column names (id, password, remember_token), the methods are
 * straightforward one-liners.
 */
export interface Authenticatable {
  /** Return the name of the unique identifier column (e.g. 'id'). */
  getAuthIdentifierName(): string

  /** Return the unique identifier value. */
  getAuthIdentifier(): string | number

  /** Return the name of the password column (e.g. 'password'). */
  getAuthPasswordName(): string

  /** Return the hashed password. */
  getAuthPassword(): string

  /** Return the remember me token value. */
  getRememberToken(): string | null

  /** Set the remember me token value. */
  setRememberToken(token: string | null): void

  /** Return the column name for the remember token (e.g. 'remember_token'). */
  getRememberTokenName(): string
}
