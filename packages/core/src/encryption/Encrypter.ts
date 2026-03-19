import type { Encrypter as EncrypterContract } from '../contracts/Encrypter.ts'
import { EncryptionError, DecryptionError, MissingAppKeyError } from './errors.ts'

/**
 * AES-256-GCM encrypter using the Web Crypto API.
 *
 * Payload format (base64-encoded JSON):
 * {
 *   iv:   string  // base64 12-byte IV
 *   value: string  // base64 ciphertext (includes GCM auth tag)
 * }
 *
 * This matches a Laravel-compatible envelope so payloads are inspectable
 * (though not interchangeable due to algorithm differences).
 */
export class AesEncrypter implements EncrypterContract {
  private cryptoKey: CryptoKey | null = null
  private readonly rawKey: ArrayBuffer

  private static readonly ALGORITHM = 'AES-GCM'
  private static readonly KEY_LENGTH = 256
  private static readonly IV_LENGTH = 12 // 96 bits recommended for GCM

  private constructor(rawKey: ArrayBuffer) {
    this.rawKey = rawKey
  }

  /**
   * Create an AesEncrypter from the APP_KEY environment variable.
   *
   * Accepts:
   * - `base64:<base64-encoded-32-byte-key>`
   * - A raw 32-byte base64 string
   */
  static async fromAppKey(appKey: string | undefined): Promise<AesEncrypter> {
    if (!appKey) throw new MissingAppKeyError()

    let keyData: ArrayBuffer

    if (appKey.startsWith('base64:')) {
      const b64 = appKey.slice(7)
      keyData = decodeBase64(b64)
    } else {
      // Try to decode as raw base64
      keyData = decodeBase64(appKey)
    }

    if (keyData.byteLength !== 32) {
      throw new EncryptionError(
        `Invalid key length: expected 32 bytes (256 bits), got ${keyData.byteLength} bytes. ` +
        'Generate a key with: openssl rand -base64 32',
      )
    }

    const encrypter = new AesEncrypter(keyData)
    await encrypter.importKey()
    return encrypter
  }

  /**
   * Create an AesEncrypter from raw key bytes (for testing or programmatic use).
   */
  static async fromRawKey(key: ArrayBuffer): Promise<AesEncrypter> {
    if (key.byteLength !== 32) {
      throw new EncryptionError(
        `Invalid key length: expected 32 bytes (256 bits), got ${key.byteLength} bytes.`,
      )
    }
    const encrypter = new AesEncrypter(key)
    await encrypter.importKey()
    return encrypter
  }

  /**
   * Generate a new random key suitable for AES-256-GCM.
   * Returns as `base64:<key>` format.
   */
  static generateKey(): string {
    const key = new Uint8Array(32)
    crypto.getRandomValues(key)
    return 'base64:' + encodeBase64(key.buffer as ArrayBuffer)
  }

  // ── Encrypter contract ──────────────────────────────────────────────────

  async encrypt(value: string): Promise<string> {
    return this.encryptPayload(new TextEncoder().encode(value))
  }

  async decrypt(encrypted: string): Promise<string> {
    const plaintext = await this.decryptPayload(encrypted)
    return new TextDecoder().decode(plaintext)
  }

  async encryptObject(value: unknown): Promise<string> {
    const json = JSON.stringify(value)
    return this.encrypt(json)
  }

  async decryptObject<T = unknown>(encrypted: string): Promise<T> {
    const json = await this.decrypt(encrypted)
    try {
      return JSON.parse(json) as T
    } catch {
      throw new DecryptionError('Decrypted payload is not valid JSON.')
    }
  }

  getKey(): ArrayBuffer {
    return this.rawKey
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async importKey(): Promise<void> {
    this.cryptoKey = await crypto.subtle.importKey(
      'raw',
      this.rawKey,
      { name: AesEncrypter.ALGORITHM, length: AesEncrypter.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  private async encryptPayload(data: Uint8Array): Promise<string> {
    if (!this.cryptoKey) throw new EncryptionError('Encryption key not initialized.')

    const iv = new Uint8Array(AesEncrypter.IV_LENGTH)
    crypto.getRandomValues(iv)

    try {
      const ciphertext = await crypto.subtle.encrypt(
        { name: AesEncrypter.ALGORITHM, iv },
        this.cryptoKey,
        data.buffer as ArrayBuffer,
      )

      const payload = {
        iv: encodeBase64(iv.buffer as ArrayBuffer),
        value: encodeBase64(ciphertext),
      }

      return btoa(JSON.stringify(payload))
    } catch (err: any) {
      throw new EncryptionError('Encryption failed.', { cause: err?.message })
    }
  }

  private async decryptPayload(encrypted: string): Promise<ArrayBuffer> {
    if (!this.cryptoKey) throw new DecryptionError('Encryption key not initialized.')

    let payload: { iv?: string; value?: string }

    try {
      payload = JSON.parse(atob(encrypted))
    } catch {
      throw new DecryptionError('The payload is not valid base64-encoded JSON.')
    }

    if (!payload.iv || !payload.value) {
      throw new DecryptionError('The payload is missing required fields (iv, value).')
    }

    const iv = decodeBase64(payload.iv)
    const ciphertext = decodeBase64(payload.value)

    try {
      return await crypto.subtle.decrypt(
        { name: AesEncrypter.ALGORITHM, iv: new Uint8Array(iv) },
        this.cryptoKey,
        ciphertext,
      )
    } catch {
      throw new DecryptionError('The MAC is invalid — the payload may have been tampered with.')
    }
  }
}

// ── Base64 helpers (Uint8Array ↔ string) ──────────────────────────────────────

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function decodeBase64(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}
