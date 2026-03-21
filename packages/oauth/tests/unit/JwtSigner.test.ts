import { describe, test, expect, beforeAll } from 'bun:test'
import { JwtSigner } from '../../src/jwt/JwtSigner.ts'
import type { JwtPayload } from '../../src/jwt/JwtPayload.ts'

describe('JwtSigner', () => {
  let signer: JwtSigner
  let privateKeyPem: string
  let publicKeyPem: string

  beforeAll(async () => {
    signer = new JwtSigner()
    const keys = await signer.generateKeyPair()
    privateKeyPem = keys.privateKey
    publicKeyPem = keys.publicKey
    await signer.loadKeys(privateKeyPem, publicKeyPem)
  })

  test('generateKeyPair returns PEM strings', () => {
    expect(privateKeyPem).toContain('PRIVATE KEY')
    expect(publicKeyPem).toContain('PUBLIC KEY')
  })

  test('sign returns a JWT with 3 parts', async () => {
    const token = await signer.sign({ sub: '1', scopes: ['read'] })
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })

  test('verify returns payload for valid token', async () => {
    const payload: JwtPayload = { sub: 'user-123', aud: 'client-1', scopes: ['read', 'write'] }
    const token = await signer.sign(payload)
    const result = await signer.verify(token)
    expect(result).not.toBeNull()
    expect(result!.sub).toBe('user-123')
    expect(result!.aud).toBe('client-1')
    expect(result!.scopes).toEqual(['read', 'write'])
  })

  test('verify sets iat automatically', async () => {
    const token = await signer.sign({ sub: '1' })
    const result = await signer.verify(token)
    expect(typeof result!.iat).toBe('number')
    expect(result!.iat!).toBeGreaterThan(0)
  })

  test('verify returns null for expired token', async () => {
    const token = await signer.sign({ sub: '1', exp: Math.floor(Date.now() / 1000) - 100 })
    const result = await signer.verify(token)
    expect(result).toBeNull()
  })

  test('verify returns null for tampered token', async () => {
    const token = await signer.sign({ sub: '1' })
    const tampered = token.slice(0, -5) + 'XXXXX'
    const result = await signer.verify(tampered)
    expect(result).toBeNull()
  })

  test('verify returns null for malformed token', async () => {
    expect(await signer.verify('not.a.jwt')).toBeNull()
    expect(await signer.verify('')).toBeNull()
    expect(await signer.verify('abc')).toBeNull()
  })

  test('sign with jti preserves it', async () => {
    const token = await signer.sign({ sub: '1', jti: 'token-uuid-123' })
    const result = await signer.verify(token)
    expect(result!.jti).toBe('token-uuid-123')
  })

  test('different keys cannot verify', async () => {
    const otherSigner = new JwtSigner()
    const otherKeys = await otherSigner.generateKeyPair()
    await otherSigner.loadKeys(otherKeys.privateKey, otherKeys.publicKey)

    const token = await signer.sign({ sub: '1' })
    const result = await otherSigner.verify(token)
    expect(result).toBeNull()
  })
})
