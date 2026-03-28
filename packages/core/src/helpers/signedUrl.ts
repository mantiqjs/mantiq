import { Application } from '../application/Application.ts'
import type { AesEncrypter } from '../encryption/Encrypter.ts'
import { UrlSigner } from '../url/UrlSigner.ts'
import { ENCRYPTER } from './encrypt.ts'

/**
 * Create a signed URL.
 *
 * @example const url = await signedUrl('https://example.com/verify?user=42')
 */
export async function signedUrl(url: string, expiresAt?: Date): Promise<string> {
  const encrypter = Application.getInstance().make<AesEncrypter>(ENCRYPTER)
  const signer = new UrlSigner(encrypter)
  return signer.sign(url, expiresAt)
}

/**
 * Validate a signed URL.
 *
 * @example const valid = await hasValidSignature('https://example.com/verify?user=42&signature=...')
 */
export async function hasValidSignature(url: string): Promise<boolean> {
  const encrypter = Application.getInstance().make<AesEncrypter>(ENCRYPTER)
  const signer = new UrlSigner(encrypter)
  return signer.validate(url)
}
