import type { JwtPayload } from './JwtPayload.ts'
import { base64UrlEncode, base64UrlDecode, base64UrlEncodeString } from './JwtEncoder.ts'

const ALGORITHM: RsaHashedImportParams = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: 'SHA-256',
}

/**
 * RS256 JWT signer/verifier using the Web Crypto API.
 * No external dependencies.
 */
export class JwtSigner {
  private privateKey: CryptoKey | null = null
  private publicKey: CryptoKey | null = null

  /**
   * Import RSA keys from PEM strings.
   */
  async loadKeys(privatePem: string, publicPem: string): Promise<void> {
    this.privateKey = await importPrivateKey(privatePem)
    this.publicKey = await importPublicKey(publicPem)
  }

  /**
   * Create a signed JWT string (header.payload.signature).
   */
  async sign(payload: JwtPayload): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not loaded. Call loadKeys() first.')
    }

    // Auto-set iat if not provided
    if (!payload.iat) {
      payload = { ...payload, iat: Math.floor(Date.now() / 1000) }
    }

    const header = { alg: 'RS256', typ: 'JWT' }
    const headerEncoded = base64UrlEncodeString(JSON.stringify(header))
    const payloadEncoded = base64UrlEncodeString(JSON.stringify(payload))

    const signingInput = `${headerEncoded}.${payloadEncoded}`
    const data = new TextEncoder().encode(signingInput)

    const signature = await crypto.subtle.sign(
      ALGORITHM.name,
      this.privateKey,
      data,
    )

    const signatureEncoded = base64UrlEncode(new Uint8Array(signature))
    return `${signingInput}.${signatureEncoded}`
  }

  /**
   * Verify a JWT token and return the decoded payload.
   * Returns null if the token is invalid or expired.
   */
  async verify(token: string): Promise<JwtPayload | null> {
    if (!this.publicKey) {
      throw new Error('Public key not loaded. Call loadKeys() first.')
    }

    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts as [string, string, string]

    try {
      const signingInput = `${headerEncoded}.${payloadEncoded}`
      const data = new TextEncoder().encode(signingInput)
      const signature = base64UrlDecode(signatureEncoded)

      const valid = await crypto.subtle.verify(
        ALGORITHM.name,
        this.publicKey,
        signature,
        data,
      )

      if (!valid) return null

      const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadEncoded))
      const payload: JwtPayload = JSON.parse(payloadJson)

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null
      }

      return payload
    } catch {
      return null
    }
  }

  /**
   * Generate a new RSA key pair and return as PEM strings.
   */
  async generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: 'SHA-256',
      },
      true, // extractable
      ['sign', 'verify'],
    )

    const privateDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    const publicDer = await crypto.subtle.exportKey('spki', keyPair.publicKey)

    return {
      privateKey: derToPem(privateDer, 'PRIVATE'),
      publicKey: derToPem(publicDer, 'PUBLIC'),
    }
  }
}

// ── PEM helpers ────────────────────────────────────────────────────────────────

function pemToDer(pem: string): ArrayBuffer {
  const lines = pem.split('\n').filter(
    (line) => !line.startsWith('-----') && line.trim().length > 0,
  )
  const base64 = lines.join('')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function derToPem(der: ArrayBuffer, type: 'PRIVATE' | 'PUBLIC'): string {
  const bytes = new Uint8Array(der)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const base64 = btoa(binary)

  // Wrap at 64 characters
  const lines: string[] = []
  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.slice(i, i + 64))
  }

  const label = type === 'PRIVATE' ? 'PRIVATE KEY' : 'PUBLIC KEY'
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem)
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    ALGORITHM,
    false,
    ['sign'],
  )
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem)
  return crypto.subtle.importKey(
    'spki',
    der,
    ALGORITHM,
    false,
    ['verify'],
  )
}
