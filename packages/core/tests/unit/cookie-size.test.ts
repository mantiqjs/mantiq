import { describe, it, expect, spyOn } from 'bun:test'
import { EncryptCookies } from '../../src/middleware/EncryptCookies.ts'
import { AesEncrypter } from '../../src/encryption/Encrypter.ts'
import type { MantiqRequest } from '../../src/contracts/Request.ts'
import { MantiqRequest as MantiqRequestImpl } from '../../src/http/Request.ts'
import { serializeCookie } from '../../src/http/Cookie.ts'

async function makeEncrypter(): Promise<AesEncrypter> {
  const key = new Uint8Array(32)
  crypto.getRandomValues(key)
  return AesEncrypter.fromRawKey(key.buffer as ArrayBuffer)
}

function makeRequest(): MantiqRequest {
  return MantiqRequestImpl.fromBun(new Request('http://localhost/test'))
}

describe('EncryptCookies — cookie size validation', () => {
  it('warns when encrypted cookie exceeds 4KB', async () => {
    const encrypter = await makeEncrypter()
    const middleware = new EncryptCookies(encrypter)
    const request = makeRequest()

    // Create a response with a very large cookie value
    const largeValue = 'x'.repeat(3000) // Will be even larger after encryption + encoding
    const response = new Response('ok', {
      headers: {
        'Set-Cookie': serializeCookie('big_cookie', largeValue, { path: '/' }),
      },
    })

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const encrypted = await middleware.handle(request, async () => response)

      // The encrypted cookie should trigger the warning
      expect(warnSpy).toHaveBeenCalled()
      const warnCall = warnSpy.mock.calls[0]?.[0] as string
      expect(warnCall).toContain('[Mantiq]')
      expect(warnCall).toContain('big_cookie')
      expect(warnCall).toContain('4KB')
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('does not warn for small cookies', async () => {
    const encrypter = await makeEncrypter()
    const middleware = new EncryptCookies(encrypter)
    const request = makeRequest()

    const response = new Response('ok', {
      headers: {
        'Set-Cookie': serializeCookie('small', 'value', { path: '/' }),
      },
    })

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    try {
      await middleware.handle(request, async () => response)
      // small cookie should not trigger any warning about size
      const sizeWarnings = warnSpy.mock.calls.filter(
        (call) => (call[0] as string).includes('4KB'),
      )
      expect(sizeWarnings.length).toBe(0)
    } finally {
      warnSpy.mockRestore()
    }
  })
})
