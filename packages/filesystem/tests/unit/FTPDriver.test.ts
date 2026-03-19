import { describe, test, expect } from 'bun:test'
import { FTPDriver } from '../../src/drivers/FTPDriver.ts'

function createDriver(overrides: Record<string, any> = {}) {
  return new FTPDriver({
    host: 'ftp.example.com',
    port: 21,
    username: 'user',
    password: 'pass',
    root: '/var/www',
    url: 'https://files.example.com',
    ...overrides,
  })
}

describe('FTPDriver', () => {
  describe('path()', () => {
    test('returns full path with root', () => {
      const driver = createDriver()
      expect(driver.path('uploads/file.txt')).toBe('/var/www/uploads/file.txt')
    })

    test('strips leading slashes from input', () => {
      const driver = createDriver()
      expect(driver.path('/uploads/file.txt')).toBe('/var/www/uploads/file.txt')
    })

    test('uses / as default root', () => {
      const driver = createDriver({ root: undefined })
      expect(driver.path('file.txt')).toBe('/file.txt')
    })
  })

  describe('url()', () => {
    test('returns url with base', () => {
      const driver = createDriver()
      expect(driver.url('uploads/file.txt')).toBe('https://files.example.com/uploads/file.txt')
    })

    test('throws when no url configured', () => {
      const driver = createDriver({ url: undefined })
      expect(() => driver.url('file.txt')).toThrow('not supported')
    })
  })

  describe('temporaryUrl()', () => {
    test('throws — not supported', async () => {
      const driver = createDriver()
      await expect(driver.temporaryUrl('file.txt', 3600)).rejects.toThrow('not supported')
    })
  })

  describe('mimeType()', () => {
    test('guesses from extension', async () => {
      const driver = createDriver()
      expect(await driver.mimeType('photo.jpg')).toBe('image/jpeg')
      expect(await driver.mimeType('doc.pdf')).toBe('application/pdf')
      expect(await driver.mimeType('style.css')).toBe('text/css')
    })

    test('returns null for unknown extensions', async () => {
      const driver = createDriver()
      expect(await driver.mimeType('data.xyz123')).toBeNull()
    })
  })
})
