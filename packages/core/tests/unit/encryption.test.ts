import { describe, it, expect } from 'bun:test'
import { AesEncrypter } from '../../src/encryption/Encrypter.ts'
import { DecryptionError, EncryptionError, MissingAppKeyError } from '../../src/encryption/errors.ts'

describe('AesEncrypter', () => {
  async function makeEncrypter(): Promise<AesEncrypter> {
    const key = new Uint8Array(32)
    crypto.getRandomValues(key)
    return AesEncrypter.fromRawKey(key.buffer as ArrayBuffer)
  }

  it('encrypts and decrypts a string', async () => {
    const enc = await makeEncrypter()
    const plain = 'hello world'
    const encrypted = await enc.encrypt(plain)
    expect(encrypted).not.toBe(plain)
    expect(await enc.decrypt(encrypted)).toBe(plain)
  })

  it('produces different ciphertext each time (random IV)', async () => {
    const enc = await makeEncrypter()
    const a = await enc.encrypt('same')
    const b = await enc.encrypt('same')
    expect(a).not.toBe(b)
  })

  it('encrypts and decrypts objects', async () => {
    const enc = await makeEncrypter()
    const obj = { user: 'alice', roles: ['admin', 'editor'] }
    const encrypted = await enc.encryptObject(obj)
    const decrypted = await enc.decryptObject(encrypted)
    expect(decrypted).toEqual(obj)
  })

  it('throws DecryptionError for tampered payload', async () => {
    const enc = await makeEncrypter()
    const encrypted = await enc.encrypt('secret')
    // Tamper by changing a character
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(enc.decrypt(tampered)).rejects.toBeInstanceOf(DecryptionError)
  })

  it('throws DecryptionError for invalid base64', async () => {
    const enc = await makeEncrypter()
    expect(enc.decrypt('not-valid-base64!!!')).rejects.toBeInstanceOf(DecryptionError)
  })

  it('throws DecryptionError with wrong key', async () => {
    const enc1 = await makeEncrypter()
    const enc2 = await makeEncrypter()
    const encrypted = await enc1.encrypt('secret')
    expect(enc2.decrypt(encrypted)).rejects.toBeInstanceOf(DecryptionError)
  })

  it('creates from APP_KEY with base64: prefix', async () => {
    const key = AesEncrypter.generateKey()
    expect(key.startsWith('base64:')).toBe(true)
    const enc = await AesEncrypter.fromAppKey(key)
    const encrypted = await enc.encrypt('test')
    expect(await enc.decrypt(encrypted)).toBe('test')
  })

  it('throws MissingAppKeyError for undefined key', () => {
    expect(AesEncrypter.fromAppKey(undefined)).rejects.toBeInstanceOf(MissingAppKeyError)
  })

  it('throws EncryptionError for wrong key length', () => {
    const shortKey = btoa('tooshort')
    expect(AesEncrypter.fromAppKey(shortKey)).rejects.toBeInstanceOf(EncryptionError)
  })

  it('generateKey produces valid 32-byte key', async () => {
    const key = AesEncrypter.generateKey()
    const enc = await AesEncrypter.fromAppKey(key)
    expect(enc.getKey().byteLength).toBe(32)
  })

  it('handles empty string', async () => {
    const enc = await makeEncrypter()
    const encrypted = await enc.encrypt('')
    expect(await enc.decrypt(encrypted)).toBe('')
  })

  it('handles unicode', async () => {
    const enc = await makeEncrypter()
    const text = '你好世界 🌍 مرحبا'
    const encrypted = await enc.encrypt(text)
    expect(await enc.decrypt(encrypted)).toBe(text)
  })
})
