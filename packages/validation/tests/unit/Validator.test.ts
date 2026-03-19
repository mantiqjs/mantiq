import { describe, test, expect } from 'bun:test'
import { Validator } from '../../src/Validator.ts'
import { ValidationError } from '@mantiq/core'
import type { Rule } from '../../src/contracts/Rule.ts'
import type { PresenceVerifier } from '../../src/contracts/PresenceVerifier.ts'

// ── Presence rules ──────────────────────────────────────────────────────────

describe('required', () => {
  test('fails when value is empty', async () => {
    const v = new Validator({}, { name: 'required' })
    expect(await v.fails()).toBe(true)
    expect(v.errors().name).toHaveLength(1)
  })

  test('passes when value is present', async () => {
    const v = new Validator({ name: 'Alice' }, { name: 'required' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for empty string', async () => {
    const v = new Validator({ name: '' }, { name: 'required' })
    expect(await v.fails()).toBe(true)
  })

  test('fails for null', async () => {
    const v = new Validator({ name: null }, { name: 'required' })
    expect(await v.fails()).toBe(true)
  })

  test('fails for empty array', async () => {
    const v = new Validator({ tags: [] }, { tags: 'required' })
    expect(await v.fails()).toBe(true)
  })
})

describe('nullable', () => {
  test('allows null values to pass', async () => {
    const v = new Validator({ name: null }, { name: 'nullable|string' })
    expect(await v.passes()).toBe(true)
    expect(v.validated().name).toBeNull()
  })

  test('allows undefined values to pass', async () => {
    const v = new Validator({}, { name: 'nullable|string' })
    expect(await v.passes()).toBe(true)
  })

  test('still validates non-null values', async () => {
    const v = new Validator({ name: 123 }, { name: 'nullable|string' })
    expect(await v.fails()).toBe(true)
  })
})

describe('present', () => {
  test('passes when key exists', async () => {
    const v = new Validator({ name: '' }, { name: 'present' })
    expect(await v.passes()).toBe(true)
  })

  test('fails when key is missing', async () => {
    const v = new Validator({}, { name: 'present' })
    expect(await v.fails()).toBe(true)
  })
})

describe('filled', () => {
  test('passes when field is not present', async () => {
    const v = new Validator({}, { name: 'filled' })
    expect(await v.passes()).toBe(true)
  })

  test('fails when field is present but empty', async () => {
    const v = new Validator({ name: '' }, { name: 'filled' })
    expect(await v.fails()).toBe(true)
  })

  test('passes when field is present and filled', async () => {
    const v = new Validator({ name: 'Alice' }, { name: 'filled' })
    expect(await v.passes()).toBe(true)
  })
})

// ── Conditional presence ────────────────────────────────────────────────────

describe('required_if', () => {
  test('required when other field matches', async () => {
    const v = new Validator({ role: 'admin' }, { permissions: 'required_if:role,admin' })
    expect(await v.fails()).toBe(true)
  })

  test('not required when other field does not match', async () => {
    const v = new Validator({ role: 'user' }, { permissions: 'required_if:role,admin' })
    expect(await v.passes()).toBe(true)
  })
})

describe('required_unless', () => {
  test('required unless other field matches', async () => {
    const v = new Validator({ role: 'user' }, { permissions: 'required_unless:role,admin' })
    expect(await v.fails()).toBe(true)
  })

  test('not required when other field matches', async () => {
    const v = new Validator({ role: 'admin' }, { permissions: 'required_unless:role,admin' })
    expect(await v.passes()).toBe(true)
  })
})

describe('required_with', () => {
  test('required when another field is present', async () => {
    const v = new Validator({ first_name: 'Alice' }, { last_name: 'required_with:first_name' })
    expect(await v.fails()).toBe(true)
  })

  test('not required when other field is empty', async () => {
    const v = new Validator({}, { last_name: 'required_with:first_name' })
    expect(await v.passes()).toBe(true)
  })
})

describe('required_without', () => {
  test('required when another field is missing', async () => {
    const v = new Validator({}, { email: 'required_without:phone' })
    expect(await v.fails()).toBe(true)
  })

  test('not required when other field is present', async () => {
    const v = new Validator({ phone: '1234' }, { email: 'required_without:phone' })
    expect(await v.passes()).toBe(true)
  })
})

// ── Type rules ──────────────────────────────────────────────────────────────

describe('string', () => {
  test('passes for strings', async () => {
    const v = new Validator({ name: 'Alice' }, { name: 'string' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for non-strings', async () => {
    const v = new Validator({ name: 123 }, { name: 'string' })
    expect(await v.fails()).toBe(true)
  })

  test('passes for empty value (implicit optional)', async () => {
    const v = new Validator({}, { name: 'string' })
    expect(await v.passes()).toBe(true)
  })
})

describe('numeric', () => {
  test('passes for numbers', async () => {
    const v = new Validator({ age: 25 }, { age: 'numeric' })
    expect(await v.passes()).toBe(true)
  })

  test('passes for numeric strings', async () => {
    const v = new Validator({ age: '25' }, { age: 'numeric' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for non-numeric', async () => {
    const v = new Validator({ age: 'abc' }, { age: 'numeric' })
    expect(await v.fails()).toBe(true)
  })
})

describe('integer', () => {
  test('passes for integers', async () => {
    const v = new Validator({ count: 5 }, { count: 'integer' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for floats', async () => {
    const v = new Validator({ count: 5.5 }, { count: 'integer' })
    expect(await v.fails()).toBe(true)
  })
})

describe('boolean', () => {
  test('passes for boolean-like values', async () => {
    for (const val of [true, false, 0, 1, '0', '1', 'true', 'false']) {
      const v = new Validator({ active: val }, { active: 'boolean' })
      expect(await v.passes()).toBe(true)
    }
  })

  test('fails for non-boolean', async () => {
    const v = new Validator({ active: 'yes' }, { active: 'boolean' })
    expect(await v.fails()).toBe(true)
  })
})

describe('array', () => {
  test('passes for arrays', async () => {
    const v = new Validator({ tags: [1, 2, 3] }, { tags: 'array' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for non-arrays', async () => {
    const v = new Validator({ tags: 'not-array' }, { tags: 'array' })
    expect(await v.fails()).toBe(true)
  })
})

describe('object', () => {
  test('passes for plain objects', async () => {
    const v = new Validator({ meta: { key: 'val' } }, { meta: 'object' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for arrays', async () => {
    const v = new Validator({ meta: [1, 2] }, { meta: 'object' })
    expect(await v.fails()).toBe(true)
  })
})

// ── Size rules ──────────────────────────────────────────────────────────────

describe('min', () => {
  test('passes for string length >= min', async () => {
    const v = new Validator({ name: 'Alice' }, { name: 'min:3' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for string length < min', async () => {
    const v = new Validator({ name: 'Al' }, { name: 'min:3' })
    expect(await v.fails()).toBe(true)
  })

  test('compares value for numbers', async () => {
    const v = new Validator({ age: 18 }, { age: 'min:21' })
    expect(await v.fails()).toBe(true)
  })
})

describe('max', () => {
  test('passes for string length <= max', async () => {
    const v = new Validator({ name: 'Alice' }, { name: 'max:10' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for string length > max', async () => {
    const v = new Validator({ name: 'A very long name indeed' }, { name: 'max:10' })
    expect(await v.fails()).toBe(true)
  })
})

describe('between', () => {
  test('passes when within range', async () => {
    const v = new Validator({ score: 50 }, { score: 'between:1,100' })
    expect(await v.passes()).toBe(true)
  })

  test('fails when outside range', async () => {
    const v = new Validator({ score: 200 }, { score: 'between:1,100' })
    expect(await v.fails()).toBe(true)
  })
})

describe('size', () => {
  test('passes when string length matches', async () => {
    const v = new Validator({ code: 'ABC' }, { code: 'size:3' })
    expect(await v.passes()).toBe(true)
  })

  test('fails when string length does not match', async () => {
    const v = new Validator({ code: 'ABCD' }, { code: 'size:3' })
    expect(await v.fails()).toBe(true)
  })
})

// ── String rules ────────────────────────────────────────────────────────────

describe('email', () => {
  test('passes for valid email', async () => {
    const v = new Validator({ email: 'alice@example.com' }, { email: 'email' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for invalid email', async () => {
    const v = new Validator({ email: 'not-an-email' }, { email: 'email' })
    expect(await v.fails()).toBe(true)
  })
})

describe('url', () => {
  test('passes for valid URL', async () => {
    const v = new Validator({ link: 'https://example.com' }, { link: 'url' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for invalid URL', async () => {
    const v = new Validator({ link: 'not-a-url' }, { link: 'url' })
    expect(await v.fails()).toBe(true)
  })
})

describe('uuid', () => {
  test('passes for valid UUID', async () => {
    const v = new Validator({ id: '550e8400-e29b-41d4-a716-446655440000' }, { id: 'uuid' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for invalid UUID', async () => {
    const v = new Validator({ id: 'not-a-uuid' }, { id: 'uuid' })
    expect(await v.fails()).toBe(true)
  })
})

describe('regex', () => {
  test('passes when value matches pattern', async () => {
    const v = new Validator({ code: 'ABC-123' }, { code: 'regex:/^[A-Z]+-\\d+$/' })
    expect(await v.passes()).toBe(true)
  })

  test('fails when value does not match', async () => {
    const v = new Validator({ code: 'abc' }, { code: 'regex:/^[A-Z]+-\\d+$/' })
    expect(await v.fails()).toBe(true)
  })
})

describe('alpha / alpha_num / alpha_dash', () => {
  test('alpha passes for letters only', async () => {
    const v = new Validator({ name: 'Alice' }, { name: 'alpha' })
    expect(await v.passes()).toBe(true)
  })

  test('alpha fails with numbers', async () => {
    const v = new Validator({ name: 'Alice123' }, { name: 'alpha' })
    expect(await v.fails()).toBe(true)
  })

  test('alpha_num passes for letters and numbers', async () => {
    const v = new Validator({ code: 'ABC123' }, { code: 'alpha_num' })
    expect(await v.passes()).toBe(true)
  })

  test('alpha_dash passes for letters, numbers, dashes, underscores', async () => {
    const v = new Validator({ slug: 'my-post_1' }, { slug: 'alpha_dash' })
    expect(await v.passes()).toBe(true)
  })
})

describe('starts_with / ends_with', () => {
  test('starts_with passes', async () => {
    const v = new Validator({ name: 'Dr. Smith' }, { name: 'starts_with:Dr.,Mr.' })
    expect(await v.passes()).toBe(true)
  })

  test('ends_with passes', async () => {
    const v = new Validator({ file: 'photo.jpg' }, { file: 'ends_with:.jpg,.png' })
    expect(await v.passes()).toBe(true)
  })
})

describe('lowercase / uppercase', () => {
  test('lowercase passes', async () => {
    const v = new Validator({ name: 'alice' }, { name: 'lowercase' })
    expect(await v.passes()).toBe(true)
  })

  test('uppercase passes', async () => {
    const v = new Validator({ code: 'ABC' }, { code: 'uppercase' })
    expect(await v.passes()).toBe(true)
  })
})

// ── Comparison rules ────────────────────────────────────────────────────────

describe('confirmed', () => {
  test('passes when confirmation matches', async () => {
    const v = new Validator(
      { password: 'secret', password_confirmation: 'secret' },
      { password: 'confirmed' },
    )
    expect(await v.passes()).toBe(true)
  })

  test('fails when confirmation does not match', async () => {
    const v = new Validator(
      { password: 'secret', password_confirmation: 'different' },
      { password: 'confirmed' },
    )
    expect(await v.fails()).toBe(true)
  })
})

describe('same / different', () => {
  test('same passes when values match', async () => {
    const v = new Validator({ a: 'foo', b: 'foo' }, { a: 'same:b' })
    expect(await v.passes()).toBe(true)
  })

  test('different passes when values differ', async () => {
    const v = new Validator({ a: 'foo', b: 'bar' }, { a: 'different:b' })
    expect(await v.passes()).toBe(true)
  })
})

describe('gt / gte / lt / lte', () => {
  test('gt passes', async () => {
    const v = new Validator({ a: 10, b: 5 }, { a: 'gt:b' })
    expect(await v.passes()).toBe(true)
  })

  test('gte passes for equal', async () => {
    const v = new Validator({ a: 5, b: 5 }, { a: 'gte:b' })
    expect(await v.passes()).toBe(true)
  })

  test('lt passes', async () => {
    const v = new Validator({ a: 3, b: 5 }, { a: 'lt:b' })
    expect(await v.passes()).toBe(true)
  })

  test('lte passes for equal', async () => {
    const v = new Validator({ a: 5, b: 5 }, { a: 'lte:b' })
    expect(await v.passes()).toBe(true)
  })
})

// ── Inclusion rules ─────────────────────────────────────────────────────────

describe('in / not_in', () => {
  test('in passes when value is in list', async () => {
    const v = new Validator({ role: 'admin' }, { role: 'in:admin,user,editor' })
    expect(await v.passes()).toBe(true)
  })

  test('in fails when value is not in list', async () => {
    const v = new Validator({ role: 'superadmin' }, { role: 'in:admin,user,editor' })
    expect(await v.fails()).toBe(true)
  })

  test('not_in passes when value is not in list', async () => {
    const v = new Validator({ role: 'admin' }, { role: 'not_in:banned,suspended' })
    expect(await v.passes()).toBe(true)
  })

  test('not_in fails when value is in list', async () => {
    const v = new Validator({ role: 'banned' }, { role: 'not_in:banned,suspended' })
    expect(await v.fails()).toBe(true)
  })
})

// ── Date rules ──────────────────────────────────────────────────────────────

describe('date', () => {
  test('passes for valid date', async () => {
    const v = new Validator({ d: '2024-01-15' }, { d: 'date' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for invalid date', async () => {
    const v = new Validator({ d: 'not-a-date' }, { d: 'date' })
    expect(await v.fails()).toBe(true)
  })
})

describe('before / after', () => {
  test('before passes', async () => {
    const v = new Validator({ d: '2024-01-01' }, { d: 'before:2024-06-01' })
    expect(await v.passes()).toBe(true)
  })

  test('after passes', async () => {
    const v = new Validator({ d: '2024-12-01' }, { d: 'after:2024-06-01' })
    expect(await v.passes()).toBe(true)
  })
})

// ── Special rules ───────────────────────────────────────────────────────────

describe('ip', () => {
  test('passes for valid IPv4', async () => {
    const v = new Validator({ ip: '192.168.1.1' }, { ip: 'ip' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for invalid IP', async () => {
    const v = new Validator({ ip: '999.999.999.999' }, { ip: 'ip' })
    expect(await v.fails()).toBe(true)
  })
})

describe('json', () => {
  test('passes for valid JSON', async () => {
    const v = new Validator({ data: '{"key":"value"}' }, { data: 'json' })
    expect(await v.passes()).toBe(true)
  })

  test('fails for invalid JSON', async () => {
    const v = new Validator({ data: '{invalid}' }, { data: 'json' })
    expect(await v.fails()).toBe(true)
  })
})

// ── Validator core features ─────────────────────────────────────────────────

describe('validate() throws ValidationError', () => {
  test('throws ValidationError on failure', async () => {
    const v = new Validator({}, { name: 'required', email: 'required|email' })
    try {
      await v.validate()
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      const err = e as ValidationError
      expect(err.errors.name).toHaveLength(1)
      expect(err.errors.email).toHaveLength(1)
    }
  })

  test('returns validated data on success', async () => {
    const v = new Validator(
      { name: 'Alice', email: 'alice@example.com', extra: 'ignored' },
      { name: 'required|string', email: 'required|email' },
    )
    const data = await v.validate()
    expect(data.name).toBe('Alice')
    expect(data.email).toBe('alice@example.com')
    expect(data.extra).toBeUndefined()
  })
})

describe('pipe-separated rules', () => {
  test('multiple rules run in sequence', async () => {
    const v = new Validator({ name: '' }, { name: 'required|string|min:3' })
    expect(await v.fails()).toBe(true)
    // Only required should fail — empty value short-circuits string and min
    expect(v.errors().name).toHaveLength(1)
    expect(v.errors().name![0]).toContain('required')
  })
})

describe('rules with parameters', () => {
  test('parses colon-separated params', async () => {
    const v = new Validator({ name: 'AB' }, { name: 'required|min:3|max:50' })
    expect(await v.fails()).toBe(true)
    expect(v.errors().name![0]).toContain('at least 3')
  })
})

describe('bail', () => {
  test('stops on first failure for a field', async () => {
    const v = new Validator({ name: '' }, { name: 'bail|required|string|min:3' })
    expect(await v.fails()).toBe(true)
    expect(v.errors().name).toHaveLength(1)
  })
})

describe('sometimes', () => {
  test('skips validation when field is absent', async () => {
    const v = new Validator({}, { nickname: 'sometimes|required|string' })
    expect(await v.passes()).toBe(true)
    expect(v.validated().nickname).toBeUndefined()
  })

  test('validates when field is present', async () => {
    const v = new Validator({ nickname: '' }, { nickname: 'sometimes|required|string' })
    expect(await v.fails()).toBe(true)
  })
})

describe('array syntax for rules', () => {
  test('accepts array of rule strings', async () => {
    const v = new Validator({ name: '' }, { name: ['required', 'string', 'min:3'] })
    expect(await v.fails()).toBe(true)
    expect(v.errors().name![0]).toContain('required')
  })

  test('accepts Rule objects in array', async () => {
    const customRule: Rule = {
      name: 'custom',
      validate: (v) => v === 'magic' || 'Must be magic.',
    }
    const v = new Validator({ code: 'nope' }, { code: ['required', customRule] })
    expect(await v.fails()).toBe(true)
    expect(v.errors().code![0]).toBe('Must be magic.')
  })
})

describe('wildcard field expansion', () => {
  test('validates array items with *', async () => {
    const v = new Validator(
      { items: [{ name: 'A' }, { name: '' }, { name: 'C' }] },
      { 'items.*.name': 'required|string' },
    )
    expect(await v.fails()).toBe(true)
    expect(v.errors()['items.1.name']).toBeDefined()
    expect(v.errors()['items.0.name']).toBeUndefined()
  })

  test('handles nested wildcards', async () => {
    const v = new Validator(
      { matrix: [[1, 2], [3, null]] },
      { 'matrix.*.*': 'required|numeric' },
    )
    expect(await v.fails()).toBe(true)
    expect(v.errors()['matrix.1.1']).toBeDefined()
  })
})

describe('nested field validation', () => {
  test('validates dot-notation fields', async () => {
    const v = new Validator(
      { user: { profile: { bio: '' } } },
      { 'user.profile.bio': 'required|string' },
    )
    expect(await v.fails()).toBe(true)
    expect(v.errors()['user.profile.bio']).toBeDefined()
  })

  test('validated data preserves nested structure', async () => {
    const v = new Validator(
      { user: { name: 'Alice', age: 30 } },
      { 'user.name': 'required|string', 'user.age': 'required|integer' },
    )
    const data = await v.validate()
    expect(data.user.name).toBe('Alice')
    expect(data.user.age).toBe(30)
  })
})

describe('custom messages', () => {
  test('uses field.rule custom message', async () => {
    const v = new Validator(
      {},
      { name: 'required' },
      { 'name.required': 'Please enter your name.' },
    )
    expect(await v.fails()).toBe(true)
    expect(v.errors().name![0]).toBe('Please enter your name.')
  })

  test('uses rule-level custom message', async () => {
    const v = new Validator(
      {},
      { name: 'required', email: 'required' },
      { required: ':attribute is mandatory.' },
    )
    expect(await v.fails()).toBe(true)
    expect(v.errors().name![0]).toBe('name is mandatory.')
    expect(v.errors().email![0]).toBe('email is mandatory.')
  })
})

describe('custom attributes', () => {
  test('replaces :attribute in custom messages', async () => {
    const v = new Validator(
      {},
      { email: 'required' },
      { required: 'The :attribute field is required.' },
      { email: 'email address' },
    )
    expect(await v.fails()).toBe(true)
    expect(v.errors().email![0]).toBe('The email address field is required.')
  })
})

describe('stopOnFirstFailure', () => {
  test('stops after first field with errors', async () => {
    const v = new Validator(
      {},
      { name: 'required', email: 'required', age: 'required' },
    )
    v.stopOnFirstFailure()
    expect(await v.fails()).toBe(true)
    expect(Object.keys(v.errors())).toHaveLength(1)
  })
})

describe('Validator.extend', () => {
  test('registers and uses custom rules globally', async () => {
    Validator.extend('even', {
      name: 'even',
      validate: (v, field) =>
        Number(v) % 2 === 0 || `The ${field} must be even.`,
    })

    const v = new Validator({ n: 3 }, { n: 'even' })
    expect(await v.fails()).toBe(true)
    expect(v.errors().n![0]).toContain('must be even')

    const v2 = new Validator({ n: 4 }, { n: 'even' })
    expect(await v2.passes()).toBe(true)

    Validator.resetExtensions()
  })
})

describe('undefined rule throws', () => {
  test('throws Error for unknown rule', async () => {
    const v = new Validator({ x: 1 }, { x: 'nonexistent_rule' })
    await expect(v.validate()).rejects.toThrow('Validation rule [nonexistent_rule] is not defined.')
  })
})

// ── Database rules (with mock verifier) ─────────────────────────────────────

describe('exists', () => {
  const mockVerifier: PresenceVerifier = {
    async getCount(table, column, value) {
      if (table === 'roles' && column === 'id' && value === 1) return 1
      return 0
    },
    async getMultiCount() { return 0 },
  }

  test('passes when value exists in table', async () => {
    const v = new Validator({ role_id: 1 }, { role_id: 'exists:roles,id' })
    v.setPresenceVerifier(mockVerifier)
    expect(await v.passes()).toBe(true)
  })

  test('fails when value does not exist', async () => {
    const v = new Validator({ role_id: 999 }, { role_id: 'exists:roles,id' })
    v.setPresenceVerifier(mockVerifier)
    expect(await v.fails()).toBe(true)
  })

  test('throws without presence verifier', async () => {
    const v = new Validator({ role_id: 1 }, { role_id: 'exists:roles,id' })
    await expect(v.validate()).rejects.toThrow('presence verifier')
  })
})

describe('unique', () => {
  const emails = new Set(['alice@example.com', 'bob@example.com'])
  const mockVerifier: PresenceVerifier = {
    async getCount(table, column, value, excludeId) {
      if (table === 'users' && column === 'email') {
        if (emails.has(value as string)) {
          // If excludeId is provided and matches, return 0 (unique check passes)
          if (excludeId === '1') return 0
          return 1
        }
        return 0
      }
      return 0
    },
    async getMultiCount() { return 0 },
  }

  test('passes for unique value', async () => {
    const v = new Validator({ email: 'new@example.com' }, { email: 'unique:users,email' })
    v.setPresenceVerifier(mockVerifier)
    expect(await v.passes()).toBe(true)
  })

  test('fails for taken value', async () => {
    const v = new Validator({ email: 'alice@example.com' }, { email: 'unique:users,email' })
    v.setPresenceVerifier(mockVerifier)
    expect(await v.fails()).toBe(true)
    expect(v.errors().email![0]).toContain('already been taken')
  })

  test('passes with exclude id', async () => {
    const v = new Validator({ email: 'alice@example.com' }, { email: 'unique:users,email,1,id' })
    v.setPresenceVerifier(mockVerifier)
    expect(await v.passes()).toBe(true)
  })
})
