import { describe, test, expect } from 'bun:test'
import { DatabasePresenceVerifier } from '../../src/DatabasePresenceVerifier.ts'
import { builtinRules } from '../../src/rules/builtin.ts'

// ── #190: SQL injection in DatabasePresenceVerifier ─────────────────────────────

describe('#190 — DatabasePresenceVerifier column name sanitization', () => {
  function mockConnection() {
    return {
      table: () => ({
        where: function () { return this },
        whereIn: function () { return this },
        count: async () => 1,
      }),
    }
  }

  test('allows valid column names', async () => {
    const verifier = new DatabasePresenceVerifier(mockConnection())
    // Should not throw for valid column names
    const count = await verifier.getCount('users', 'email', 'test@example.com', null, 'id', [
      ['status', '=', 'active'],
    ])
    expect(count).toBe(1)
  })

  test('allows dotted column names (table.column)', async () => {
    const verifier = new DatabasePresenceVerifier(mockConnection())
    const count = await verifier.getCount('users', 'email', 'test@example.com', null, 'id', [
      ['users.status', '=', 'active'],
    ])
    expect(count).toBe(1)
  })

  test('rejects column names with SQL injection in getCount', async () => {
    const verifier = new DatabasePresenceVerifier(mockConnection())
    await expect(
      verifier.getCount('users', 'email', 'test@example.com', null, 'id', [
        ['status; DROP TABLE users --', '=', 'active'],
      ]),
    ).rejects.toThrow('Invalid column name')
  })

  test('rejects column names with spaces in getCount', async () => {
    const verifier = new DatabasePresenceVerifier(mockConnection())
    await expect(
      verifier.getCount('users', 'email', 'test@example.com', null, 'id', [
        ['col name', '=', 'val'],
      ]),
    ).rejects.toThrow('Invalid column name')
  })

  test('rejects column names with SQL injection in getMultiCount', async () => {
    const verifier = new DatabasePresenceVerifier(mockConnection())
    await expect(
      verifier.getMultiCount('users', 'email', ['a', 'b'], [
        ['1=1; --', '=', 'active'],
      ]),
    ).rejects.toThrow('Invalid column name')
  })

  test('allows underscored column names', async () => {
    const verifier = new DatabasePresenceVerifier(mockConnection())
    const count = await verifier.getMultiCount('users', 'email', ['a', 'b'], [
      ['is_verified', '=', true],
    ])
    expect(count).toBe(1)
  })
})

// ── #177: ReDoS in validation regex rule ────────────────────────────────────────

describe('#177 — regex rule ReDoS protection', () => {
  const regexRule = builtinRules['regex']!

  test('valid regex pattern works normally', () => {
    const result = regexRule.validate('hello123', 'field', {}, ['/^[a-z0-9]+$/'])
    expect(result).toBe(true)
  })

  test('valid regex rejects non-matching input', () => {
    const result = regexRule.validate('hello!', 'field', {}, ['/^[a-z0-9]+$/'])
    expect(result).toBe('The field field format is invalid.')
  })

  test('invalid regex syntax fails gracefully', () => {
    const result = regexRule.validate('test', 'field', {}, ['/[invalid/'])
    expect(result).toBe('The field field format is invalid.')
  })

  test('nested quantifiers (a+)+ are rejected as ReDoS risk', () => {
    const result = regexRule.validate('aaaa', 'field', {}, ['/(a+)+$/'])
    expect(result).toBe('The field field format is invalid.')
  })

  test('nested quantifiers (.*)+  are rejected', () => {
    const result = regexRule.validate('test', 'field', {}, ['/(.*)+/'])
    expect(result).toBe('The field field format is invalid.')
  })

  test('empty value skips validation', () => {
    const result = regexRule.validate('', 'field', {}, ['/(a+)+/'])
    expect(result).toBe(true)
  })

  test('null value skips validation', () => {
    const result = regexRule.validate(null, 'field', {}, ['/(a+)+/'])
    expect(result).toBe(true)
  })

  test('simple patterns without nested quantifiers work fine', () => {
    const result = regexRule.validate('hello', 'field', {}, ['/^\\w+$/'])
    expect(result).toBe(true)
  })

  test('regex without slashes works', () => {
    const result = regexRule.validate('abc', 'field', {}, ['^[a-z]+$'])
    expect(result).toBe(true)
  })
})
