import { describe, it, expect } from 'bun:test'
import { errorFingerprint, normalizeQuery } from '../../src/helpers/fingerprint.ts'

describe('errorFingerprint', () => {
  it('produces consistent fingerprints for the same error', () => {
    const err1 = new TypeError('Cannot read property of null')
    const err2 = new TypeError('Cannot read property of null')

    expect(errorFingerprint(err1)).toBe(errorFingerprint(err2))
  })

  it('produces different fingerprints for different errors', () => {
    const err1 = new TypeError('type error')
    const err2 = new RangeError('range error')

    expect(errorFingerprint(err1)).not.toBe(errorFingerprint(err2))
  })

  it('returns an 8-character hex string', () => {
    const fp = errorFingerprint(new Error('test'))
    expect(fp).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('normalizeQuery', () => {
  it('replaces string literals with placeholders', () => {
    expect(normalizeQuery("SELECT * FROM users WHERE name = 'john'")).toBe('SELECT * FROM users WHERE name = ?')
  })

  it('replaces numeric literals', () => {
    expect(normalizeQuery('SELECT * FROM users WHERE id = 42')).toBe('SELECT * FROM users WHERE id = ?')
  })

  it('collapses IN lists', () => {
    expect(normalizeQuery('SELECT * FROM users WHERE id IN (1, 2, 3)')).toBe('SELECT * FROM users WHERE id IN (?)')
  })

  it('normalizes whitespace', () => {
    expect(normalizeQuery('SELECT  *  FROM   users')).toBe('SELECT * FROM users')
  })

  it('handles float values', () => {
    expect(normalizeQuery('WHERE price > 9.99')).toBe('WHERE price > ?')
  })
})
