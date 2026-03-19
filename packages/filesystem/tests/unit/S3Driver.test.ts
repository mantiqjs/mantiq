import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { S3Driver } from '../../src/drivers/S3Driver.ts'

// Mock the AWS SDK — S3Driver uses lazy dynamic imports, so we mock the module
// These tests verify the driver's logic without needing real AWS credentials.

function createDriver(overrides: Record<string, any> = {}) {
  return new S3Driver({
    bucket: 'test-bucket',
    region: 'us-east-1',
    key: 'AKIAIOSFODNN7EXAMPLE',
    secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    root: 'uploads',
    url: 'https://cdn.example.com',
    visibility: 'private',
    ...overrides,
  })
}

describe('S3Driver', () => {
  describe('constructor', () => {
    test('sets prefix from root config', () => {
      const driver = createDriver({ root: 'my-prefix' })
      expect(driver.path('file.txt')).toBe('my-prefix/file.txt')
    })

    test('handles no root prefix', () => {
      const driver = createDriver({ root: undefined })
      expect(driver.path('file.txt')).toBe('file.txt')
    })

    test('strips leading/trailing slashes from root', () => {
      const driver = createDriver({ root: '/uploads/' })
      expect(driver.path('file.txt')).toBe('uploads/file.txt')
    })
  })

  describe('path()', () => {
    test('returns prefixed key', () => {
      const driver = createDriver()
      expect(driver.path('photos/avatar.jpg')).toBe('uploads/photos/avatar.jpg')
    })

    test('strips leading slashes from input', () => {
      const driver = createDriver()
      expect(driver.path('/photos/avatar.jpg')).toBe('uploads/photos/avatar.jpg')
    })
  })

  describe('url()', () => {
    test('uses custom url base when configured', () => {
      const driver = createDriver({ url: 'https://cdn.example.com' })
      expect(driver.url('photos/avatar.jpg')).toBe('https://cdn.example.com/uploads/photos/avatar.jpg')
    })

    test('strips trailing slash from url base', () => {
      const driver = createDriver({ url: 'https://cdn.example.com/' })
      expect(driver.url('file.txt')).toBe('https://cdn.example.com/uploads/file.txt')
    })

    test('generates S3 URL when no custom url', () => {
      const driver = createDriver({ url: undefined })
      expect(driver.url('file.txt')).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/uploads/file.txt')
    })

    test('uses endpoint URL for S3-compatible services', () => {
      const driver = createDriver({
        url: undefined,
        endpoint: 'https://s3.example.com',
        forcePathStyle: true,
      })
      expect(driver.url('file.txt')).toBe('https://s3.example.com/test-bucket/uploads/file.txt')
    })

    test('uses endpoint without path style for virtual-hosted style', () => {
      const driver = createDriver({
        url: undefined,
        endpoint: 'https://bucket.r2.cloudflarestorage.com',
      })
      expect(driver.url('file.txt')).toBe('https://bucket.r2.cloudflarestorage.com/uploads/file.txt')
    })
  })
})
