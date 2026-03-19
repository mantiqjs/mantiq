/**
 * Contract for encryption services.
 *
 * All implementations must provide symmetric encrypt/decrypt using
 * a consistent serialization format.
 */
export interface Encrypter {
  /**
   * Encrypt a string value.
   */
  encrypt(value: string): Promise<string>

  /**
   * Decrypt a string value.
   */
  decrypt(encrypted: string): Promise<string>

  /**
   * Encrypt a value (serialized as JSON).
   */
  encryptObject(value: unknown): Promise<string>

  /**
   * Decrypt and deserialize a JSON value.
   */
  decryptObject<T = unknown>(encrypted: string): Promise<T>

  /**
   * Get the encryption key.
   */
  getKey(): CryptoKey | ArrayBuffer
}
