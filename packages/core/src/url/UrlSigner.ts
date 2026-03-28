import type { AesEncrypter } from '../encryption/Encrypter.ts'

/**
 * URL signing utility.
 *
 * Generates signed URLs with HMAC-based signatures so you can create links
 * that prove they haven't been tampered with (e.g. email verification links,
 * temporary download URLs).
 *
 * Uses the application's AesEncrypter key to derive HMAC-SHA256 signatures.
 *
 * @example
 * ```ts
 * const signer = new UrlSigner(encrypter)
 * const signed = await signer.sign('https://example.com/verify?user=42')
 * const isValid = await signer.validate(signed) // true
 *
 * const temp = await signer.temporarySignedUrl('https://example.com/download/file.zip', 60)
 * ```
 */
export class UrlSigner {
  private signingKey: CryptoKey | null = null

  constructor(private readonly encrypter: AesEncrypter) {}

  /**
   * Sign a URL by appending a signature (and optional expiration) as query parameters.
   */
  async sign(url: string, expiresAt?: Date): Promise<string> {
    const parsed = new URL(url)

    // Remove any existing signature params to prevent double-signing
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
   * Validate a signed URL — verify the signature and check expiration.
   */
  async validate(url: string): Promise<boolean> {
    const parsed = new URL(url)

    const signature = parsed.searchParams.get('signature')
    if (!signature) return false

    // Check expiration before verifying signature
    const expires = parsed.searchParams.get('expires')
    if (expires) {
      const expiresAt = Number(expires) * 1000
      if (Date.now() > expiresAt) return false
    }

    // Reconstruct the URL without the signature to verify
    parsed.searchParams.delete('signature')
    const expectedSignature = await this.createSignature(parsed.toString())

    return timingSafeEqual(signature, expectedSignature)
  }

  /**
   * Create a temporary signed URL that expires after the given number of minutes.
   */
  async temporarySignedUrl(url: string, minutes: number): Promise<string> {
    return this.sign(url, new Date(Date.now() + minutes * 60_000))
  }

  // ── Internal ────────────────────────────────────────────────────────────

  /**
   * Derive the HMAC signing key from the encrypter's raw AES key.
   */
  private async getSigningKey(): Promise<CryptoKey> {
    if (this.signingKey) return this.signingKey

    this.signingKey = await crypto.subtle.importKey(
      'raw',
      this.encrypter.getKey() as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )

    return this.signingKey
  }

  /**
   * Create an HMAC-SHA256 signature for the given data string.
   */
  private async createSignature(data: string): Promise<string> {
    const key = await this.getSigningKey()
    const encoded = new TextEncoder().encode(data)
    const signature = await crypto.subtle.sign('HMAC', key, encoded)
    return encodeHex(new Uint8Array(signature))
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function encodeHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Constant-time string comparison to prevent timing attacks on signature verification.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)

  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i]! ^ bufB[i]!
  }
  return result === 0
}
