import { describe, test, expect } from 'bun:test'
import { AzureBlobDriver } from '../../src/drivers/AzureBlobDriver.ts'

function createDriver(overrides: Record<string, any> = {}) {
  return new AzureBlobDriver({
    container: 'my-container',
    accountName: 'mystorageaccount',
    accountKey: 'fakekey==',
    root: 'media',
    visibility: 'private',
    ...overrides,
  })
}

describe('AzureBlobDriver', () => {
  describe('constructor', () => {
    test('sets prefix from root config', () => {
      const driver = createDriver({ root: 'uploads' })
      expect(driver.path('file.txt')).toBe('uploads/file.txt')
    })

    test('handles no root prefix', () => {
      const driver = createDriver({ root: undefined })
      expect(driver.path('file.txt')).toBe('file.txt')
    })
  })

  describe('path()', () => {
    test('returns prefixed key', () => {
      const driver = createDriver()
      expect(driver.path('images/photo.jpg')).toBe('media/images/photo.jpg')
    })
  })

  describe('url()', () => {
    test('uses custom url base when configured', () => {
      const driver = createDriver({ url: 'https://cdn.example.com' })
      expect(driver.url('images/photo.jpg')).toBe('https://cdn.example.com/media/images/photo.jpg')
    })

    test('generates Azure URL from accountName', () => {
      const driver = createDriver({ url: undefined })
      expect(driver.url('file.txt')).toBe(
        'https://mystorageaccount.blob.core.windows.net/my-container/media/file.txt',
      )
    })

    test('throws when no url or accountName configured', () => {
      const driver = createDriver({ url: undefined, accountName: undefined })
      expect(() => driver.url('file.txt')).toThrow('Cannot generate URL')
    })
  })
})
