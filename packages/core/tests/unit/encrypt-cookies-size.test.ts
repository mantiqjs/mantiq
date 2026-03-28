import { describe, it, expect, mock } from 'bun:test'
import { EncryptCookies } from '../../src/middleware/EncryptCookies.ts'
import { AesEncrypter } from '../../src/encryption/Encrypter.ts'
import type { MantiqRequest } from '../../src/contracts/Request.ts'
import { MantiqRequest as MantiqRequestImpl } from '../../src/http/Request.ts'

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

    // Create a value large enough that encrypted form > 4096 bytes
    const largeValue = 'x'.repeat(3000)

    const warnSpy = mock(() => {})
    const originalWarn = console.warn
    console.warn = warnSpy

    try {
      const responseWithCookie = new Response('ok', {
        headers: {
          'Set-Cookie': `big_cookie=${largeValue}; Path=/; HttpOnly`,
        },
      })

      await middleware.handle(makeRequest(), async () => responseWithCookie)

      // The encrypted output is larger than the input, so a 3000-char value
      // should produce a Set-Cookie header exceeding 4096 bytes
      expect(warnSpy).toHaveBeenCalled()
      const call = warnSpy.mock.calls[0] as string[]
      expect(call[0]).toContain('Cookie "big_cookie" exceeds 4KB')
    } finally {
      console.warn = originalWarn
    }
  })

  it('does not warn for small cookies', async () => {
    const encrypter = await makeEncrypter()
    const middleware = new EncryptCookies(encrypter)

    const warnSpy = mock(() => {})
    const originalWarn = console.warn
    console.warn = warnSpy

    try {
      const responseWithCookie = new Response('ok', {
        headers: {
          'Set-Cookie': `small=value; Path=/; HttpOnly`,
        },
      })

      await middleware.handle(makeRequest(), async () => responseWithCookie)

      // Small cookie should not trigger the warning
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      console.warn = originalWarn
    }
  })
})
