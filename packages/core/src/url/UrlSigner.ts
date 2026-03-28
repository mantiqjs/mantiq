import type { AesEncrypter } from '../encryption/Encrypter.ts'

/**
 * Signs URLs with an HMAC-based signature derived from the application encrypter.
 *
 * Supports both permanent and temporary signed URLs, matching the Laravel
 * pattern for verifiable, tamper-proof links (e.g., email verification,
 * unsubscribe links, file downloads).
 *
 * @example
 * ```ts
 * const signer = new UrlSigner(encrypter)
 *
 * // Permanent signed URL
 * const signed = await signer.sign('https://example.com/unsubscribe?user=42')
 *
 * // Temporary signed URL (valid for 60 minutes)
 * const temp = await signer.temporarySignedUrl('https://example.com/download/file.zip', 60)
 *
 * // Validate
 * await signer.validate(signed) // true
 * await signer.validate(temp)   // true (if not expired)
 * ```
 */
export class UrlSigner {
  constructor(private readonly encrypter: AesEncrypter) {}

  /**
   * Sign a URL by appending a cryptographic signature query parameter.
   * Optionally adds an expiration timestamp.
   */
  async sign(url: string, expiresAt?: Date): Promise<string> {
    const parsed = new URL(url)

    // Remove any existing signature params (re-signing)
    parsed.searchParams.delete('signature')
    parsed.searchParams.delete('expires')

    if (expiresAt) {
      parsed.searchParams.set('expires', String(Math.floor(expiresAt.getTime() / 1000)))
    }

    const signature = await this.createSignature(parsed.toString())
    parsed.searchParams.set('signature', signature)

    return parsed.toString()
  }

  /**
   * Validate a signed URL: verify the signature and check expiration.
   */
  async validate(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url)

      const signature = parsed.searchParams.get('signature')
      if (!signature) return false

      // Check expiration first
      const expires = parsed.searchParams.get('expires')
      if (expires) {
        const expiresAt = Number(expires) * 1000
        if (Date.now() > expiresAt) return false
      }

      // Reconstruct the URL without the signature param
      parsed.searchParams.delete('signature')
      const expected = await this.createSignature(parsed.toString())

      return this.timingSafeEqual(signature, expected)
    } catch {
      return false
    }
  }

  /**
   * Create a temporary signed URL that expires after the given number of minutes.
   */
  async temporarySignedUrl(url: string, minutes: number): Promise<string> {
    return this.sign(url, new Date(Date.now() + minutes * 60_000))
  }

  /**
   * Create an HMAC signature for the given URL using the encrypter's key.
   */
  private async createSignature(url: string): Promise<string> {
    const key = this.encrypter.getKey()
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const data = new TextEncoder().encode(url)
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)

    return this.bufferToHex(signature)
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return result === 0
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let hex = ''
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i]!.toString(16).padStart(2, '0')
    }
    return hex
  }
}
