import { Application } from '../application/Application.ts'
import type { AesEncrypter } from '../encryption/Encrypter.ts'
import { UrlSigner } from '../url/UrlSigner.ts'
import { ENCRYPTER } from './encrypt.ts'

/**
 * Create a signed URL.
 *
 * @example
 * const url = await signedUrl('https://example.com/unsubscribe?user=42')
 * const temp = await signedUrl('https://example.com/download', new Date(Date.now() + 3600_000))
 */
export async function signedUrl(url: string, expiresAt?: Date): Promise<string> {
  const encrypter = Application.getInstance().make<AesEncrypter>(ENCRYPTER)
  const signer = new UrlSigner(encrypter)
  return signer.sign(url, expiresAt)
}

/**
 * Validate a signed URL: verify signature and check expiration.
 *
 * @example
 * if (await hasValidSignature(request.fullUrl())) {
 *   // URL is authentic and not expired
 * }
 */
export async function hasValidSignature(url: string): Promise<boolean> {
  const encrypter = Application.getInstance().make<AesEncrypter>(ENCRYPTER)
  const signer = new UrlSigner(encrypter)
  return signer.validate(url)
}
