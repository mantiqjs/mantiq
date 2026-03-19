import { Application } from '../application/Application.ts'
import type { AesEncrypter } from '../encryption/Encrypter.ts'

export const ENCRYPTER = Symbol('Encrypter')

/**
 * Encrypt a string value using the application encrypter.
 *
 * @example const token = await encrypt('secret-value')
 */
export async function encrypt(value: string): Promise<string> {
  return Application.getInstance().make<AesEncrypter>(ENCRYPTER).encrypt(value)
}

/**
 * Decrypt a string value using the application encrypter.
 *
 * @example const plain = await decrypt(token)
 */
export async function decrypt(value: string): Promise<string> {
  return Application.getInstance().make<AesEncrypter>(ENCRYPTER).decrypt(value)
}
