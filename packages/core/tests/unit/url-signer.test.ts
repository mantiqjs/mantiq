import { describe, it, expect } from 'bun:test'
import { AesEncrypter } from '../../src/encryption/Encrypter.ts'
import { UrlSigner } from '../../src/url/UrlSigner.ts'

async function makeEncrypter(): Promise<AesEncrypter> {
  const key = new Uint8Array(32)
  crypto.getRandomValues(key)
  return AesEncrypter.fromRawKey(key.buffer as ArrayBuffer)
}

describe('UrlSigner', () => {
  it('signs and validates a URL', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const signed = await signer.sign('https://example.com/unsubscribe?user=42')
    expect(signed).toContain('signature=')
    expect(await signer.validate(signed)).toBe(true)
  })

  it('rejects a tampered URL', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const signed = await signer.sign('https://example.com/path?id=1')
    // Tamper with the URL by changing the id
    const tampered = signed.replace('id=1', 'id=999')
    expect(await signer.validate(tampered)).toBe(false)
  })

  it('rejects a URL with missing signature', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    expect(await signer.validate('https://example.com/path')).toBe(false)
  })

  it('creates temporary signed URLs with expiration', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const signed = await signer.temporarySignedUrl('https://example.com/download', 60)
    expect(signed).toContain('expires=')
    expect(signed).toContain('signature=')
    expect(await signer.validate(signed)).toBe(true)
  })

  it('rejects expired temporary URLs', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    // Sign with a date in the past
    const signed = await signer.sign(
      'https://example.com/download',
      new Date(Date.now() - 60_000), // 1 minute ago
    )
    expect(await signer.validate(signed)).toBe(false)
  })

  it('validates non-expired temporary URLs', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const signed = await signer.sign(
      'https://example.com/download',
      new Date(Date.now() + 3_600_000), // 1 hour from now
    )
    expect(await signer.validate(signed)).toBe(true)
  })

  it('rejects URL signed with a different key', async () => {
    const encrypter1 = await makeEncrypter()
    const encrypter2 = await makeEncrypter()
    const signer1 = new UrlSigner(encrypter1)
    const signer2 = new UrlSigner(encrypter2)

    const signed = await signer1.sign('https://example.com/secret')
    expect(await signer2.validate(signed)).toBe(false)
  })

  it('handles URLs with existing query parameters', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const signed = await signer.sign('https://example.com/page?foo=bar&baz=qux')
    expect(await signer.validate(signed)).toBe(true)

    // Existing params are preserved
    const parsed = new URL(signed)
    expect(parsed.searchParams.get('foo')).toBe('bar')
    expect(parsed.searchParams.get('baz')).toBe('qux')
  })

  it('re-signing strips old signature', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    const first = await signer.sign('https://example.com/path')
    const second = await signer.sign(first) // re-sign

    // Both should be valid
    expect(await signer.validate(second)).toBe(true)

    // Only one signature param
    const parsed = new URL(second)
    const signatureValues = parsed.searchParams.getAll('signature')
    expect(signatureValues.length).toBe(1)
  })

  it('returns false for malformed URLs', async () => {
    const encrypter = await makeEncrypter()
    const signer = new UrlSigner(encrypter)

    expect(await signer.validate('not-a-url')).toBe(false)
  })
})
