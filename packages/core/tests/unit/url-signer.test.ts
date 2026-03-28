import { describe, it, expect } from 'bun:test'
import { UrlSigner } from '../../src/url/UrlSigner.ts'
import { AesEncrypter } from '../../src/encryption/Encrypter.ts'

async function makeEncrypter(): Promise<AesEncrypter> {
  const key = new Uint8Array(32)
  crypto.getRandomValues(key)
  return AesEncrypter.fromRawKey(key.buffer as ArrayBuffer)
}

describe('UrlSigner', () => {
  it('signs and validates a URL', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const url = 'https://example.com/verify?user=42'
    const signed = await signer.sign(url)

    expect(signed).toContain('signature=')
    expect(await signer.validate(signed)).toBe(true)
  })

  it('rejects a tampered URL', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const signed = await signer.sign('https://example.com/verify?user=42')

    // Tamper with the URL
    const tampered = signed.replace('user=42', 'user=99')
    expect(await signer.validate(tampered)).toBe(false)
  })

  it('rejects a URL with missing signature', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    expect(await signer.validate('https://example.com/verify?user=42')).toBe(false)
  })

  it('rejects a URL with an invalid signature', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const url = 'https://example.com/verify?user=42&signature=deadbeef'
    expect(await signer.validate(url)).toBe(false)
  })

  it('signs with expiration and validates before expiry', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const expiresAt = new Date(Date.now() + 60_000) // 1 minute from now
    const signed = await signer.sign('https://example.com/download', expiresAt)

    expect(signed).toContain('expires=')
    expect(await signer.validate(signed)).toBe(true)
  })

  it('rejects an expired URL', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const expiresAt = new Date(Date.now() - 1000) // 1 second ago
    const signed = await signer.sign('https://example.com/download', expiresAt)

    expect(await signer.validate(signed)).toBe(false)
  })

  it('creates temporary signed URLs', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const signed = await signer.temporarySignedUrl('https://example.com/file.zip', 30)

    expect(signed).toContain('expires=')
    expect(signed).toContain('signature=')
    expect(await signer.validate(signed)).toBe(true)
  })

  it('different keys produce different signatures', async () => {
    const encrypter1 = await makeEncrypter()
    const encrypter2 = await makeEncrypter()
    const signer1 = new UrlSigner(encrypter1)
    const signer2 = new UrlSigner(encrypter2)

    const url = 'https://example.com/verify?user=42'
    const signed1 = await signer1.sign(url)

    // Signed with different key should not validate
    expect(await signer2.validate(signed1)).toBe(false)
  })

  it('does not double-sign a URL', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const url = 'https://example.com/verify?user=42'
    const signed = await signer.sign(url)
    const doubleSigned = await signer.sign(signed)

    // Should still validate (old signature removed, new one added)
    expect(await signer.validate(doubleSigned)).toBe(true)

    // Should have exactly one signature param
    const parsed = new URL(doubleSigned)
    const signatureValues = parsed.searchParams.getAll('signature')
    expect(signatureValues.length).toBe(1)
  })
})
