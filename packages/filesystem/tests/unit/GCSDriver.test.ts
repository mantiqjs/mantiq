import { describe, test, expect } from 'bun:test'
import { GCSDriver } from '../../src/drivers/GCSDriver.ts'

function createDriver(overrides: Record<string, any> = {}) {
  return new GCSDriver({
    bucket: 'my-gcs-bucket',
    projectId: 'my-project',
    root: 'data',
    url: 'https://cdn.example.com',
    visibility: 'private',
    ...overrides,
  })
}

describe('GCSDriver', () => {
  describe('constructor', () => {
    test('sets prefix from root config', () => {
      const driver = createDriver({ root: 'my-prefix' })
      expect(driver.path('file.txt')).toBe('my-prefix/file.txt')
    })

    test('handles no root prefix', () => {
      const driver = createDriver({ root: undefined })
      expect(driver.path('file.txt')).toBe('file.txt')
    })
  })

  describe('path()', () => {
    test('returns prefixed key', () => {
      const driver = createDriver()
      expect(driver.path('docs/readme.md')).toBe('data/docs/readme.md')
    })
  })

  describe('url()', () => {
    test('uses custom url base when configured', () => {
      const driver = createDriver({ url: 'https://cdn.example.com' })
      expect(driver.url('docs/readme.md')).toBe('https://cdn.example.com/data/docs/readme.md')
    })

    test('generates GCS public URL when no custom url', () => {
      const driver = createDriver({ url: undefined })
      expect(driver.url('file.txt')).toBe('https://storage.googleapis.com/my-gcs-bucket/data/file.txt')
    })
  })
})
