/**
 * Contract for hashing services.
 */
export interface Hasher {
  /**
   * Hash a plain-text value.
   */
  make(value: string): Promise<string>

  /**
   * Check a plain-text value against a hash.
   */
  check(value: string, hashedValue: string): Promise<boolean>

  /**
   * Check if the given hash needs to be re-hashed (e.g. cost changed).
   */
  needsRehash(hashedValue: string): boolean
}
