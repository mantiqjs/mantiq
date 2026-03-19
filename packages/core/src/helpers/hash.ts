import { Application } from '../application/Application.ts'
import { HashManager } from '../hashing/HashManager.ts'

/**
 * Hash a plain-text value using the default hasher.
 *
 * @example const hashed = await hash('password')
 */
export async function hash(value: string): Promise<string> {
  return Application.getInstance().make(HashManager).make(value)
}

/**
 * Check a plain-text value against a hash.
 *
 * @example if (await hashCheck('password', hashed)) { ... }
 */
export async function hashCheck(value: string, hashedValue: string): Promise<boolean> {
  return Application.getInstance().make(HashManager).check(value, hashedValue)
}
