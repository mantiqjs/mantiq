import { describe, test, expect } from 'bun:test'
import { SFTPDriver } from '../../src/drivers/SFTPDriver.ts'

function createDriver(overrides: Record<string, any> = {}) {
  return new SFTPDriver({
    host: 'sftp.example.com',
    port: 22,
    username: 'deploy',
    password: 'secret',
    root: '/home/deploy/app',
    url: 'https://assets.example.com',
    ...overrides,
  })
}

describe('SFTPDriver', () => {
  describe('path()', () => {
    test('returns full path with root', () => {
      const driver = createDriver()
      expect(driver.path('uploads/file.txt')).toBe('/home/deploy/app/uploads/file.txt')
    })

    test('strips leading slashes from input', () => {
      const driver = createDriver()
      expect(driver.path('/uploads/file.txt')).toBe('/home/deploy/app/uploads/file.txt')
    })

    test('uses / as default root', () => {
      const driver = createDriver({ root: undefined })
      expect(driver.path('file.txt')).toBe('/file.txt')
    })
  })

  describe('url()', () => {
    test('returns url with base', () => {
      const driver = createDriver()
      expect(driver.url('uploads/file.txt')).toBe('https://assets.example.com/uploads/file.txt')
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
      expect(await driver.mimeType('image.png')).toBe('image/png')
      expect(await driver.mimeType('app.js')).toBe('application/javascript')
      expect(await driver.mimeType('data.json')).toBe('application/json')
    })

    test('returns null for unknown extensions', async () => {
      const driver = createDriver()
      expect(await driver.mimeType('file.unknown')).toBeNull()
    })
  })
})
