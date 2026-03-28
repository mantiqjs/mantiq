/**
 * Edge-case tests for Validator — complex rules, wildcards, nested objects.
 *
 * Run: bun test packages/validation/tests/edge/complex-rules.test.ts
 */
import { describe, test, expect, afterEach } from 'bun:test'
import { Validator } from '../../src/Validator.ts'
import type { Rule } from '../../src/contracts/Rule.ts'

afterEach(() => {
  Validator.resetExtensions()
})

describe('Validator edge cases', () => {
  // ── Wildcard expansion ────────────────────────────────────────────────

  test('items.*.name with 100 items validates all correctly', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ name: `Item ${i}` }))
    const v = new Validator({ items }, { 'items.*.name': 'required|string' })
    const result = await v.validate()
    expect(Object.keys(result.items as any)).toHaveLength(100)
  })

  test('deeply nested a.*.b.*.c validates all paths', async () => {
    const data = {
      a: [
        { b: [{ c: 'x' }, { c: 'y' }] },
        { b: [{ c: 'z' }] },
      ],
    }
    const v = new Validator(data, { 'a.*.b.*.c': 'required|string' })
    expect(await v.passes()).toBe(true)
  })

  test('wildcard with failing items collects errors for each path', async () => {
    const data = {
      items: [
        { name: '' },
        { name: 'valid' },
        { name: '' },
      ],
    }
    const v = new Validator(data, { 'items.*.name': 'required' })
    expect(await v.fails()).toBe(true)
    const errors = v.errors()
    expect(errors['items.0.name']).toBeDefined()
    expect(errors['items.2.name']).toBeDefined()
    expect(errors['items.1.name']).toBeUndefined()
  })

  // ── required_if with dot-notation ─────────────────────────────────────

  test('required_if with dot-notation resolves nested value', async () => {
    const data = { config: { feature: { enabled: 'yes' } }, detail: '' }
    const v = new Validator(data, {
      detail: 'required_if:config.feature.enabled,yes',
    })
    expect(await v.fails()).toBe(true)
    const errors = v.errors()
    expect(errors['detail']).toBeDefined()
  })

  // ── confirmed rule ────────────────────────────────────────────────────

  test('confirmed: password + password_confirmation exact match', async () => {
    const v = new Validator(
      { password: 'secret123', password_confirmation: 'secret123' },
      { password: 'required|confirmed' },
    )
    expect(await v.passes()).toBe(true)
  })

  test('confirmed: mismatch fails', async () => {
    const v = new Validator(
      { password: 'secret123', password_confirmation: 'wrong' },
      { password: 'required|confirmed' },
    )
    expect(await v.fails()).toBe(true)
  })

  // ── bail rule ─────────────────────────────────────────────────────────

  test('bail stops after first failure', async () => {
    const v = new Validator(
      { email: '' },
      { email: 'bail|required|email' },
    )
    await v.fails()
    const errors = v.errors()
    expect(errors['email']).toHaveLength(1)
    expect(errors['email']![0]).toContain('required')
  })

  // ── sometimes ─────────────────────────────────────────────────────────

  test('sometimes skips validation if field absent', async () => {
    const v = new Validator({}, { nickname: 'sometimes|required|string' })
    expect(await v.passes()).toBe(true)
  })

  test('sometimes validates if field is present', async () => {
    const v = new Validator({ nickname: '' }, { nickname: 'sometimes|required|string' })
    expect(await v.fails()).toBe(true)
  })

  // ── Custom messages with :attribute placeholder ────────────────────────

  test('custom messages with :attribute placeholder', async () => {
    const v = new Validator(
      { email: '' },
      { email: 'required' },
      { required: 'The :attribute is mandatory.' },
    )
    await v.fails()
    const errors = v.errors()
    expect(errors['email']![0]).toBe('The email is mandatory.')
  })

  // ── Validator.extend() custom rule ────────────────────────────────────

  test('Validator.extend() registers and uses custom rule', async () => {
    const evenRule: Rule = {
      name: 'even',
      validate: (v, field) =>
        typeof v === 'number' && v % 2 === 0 ? true : `The ${field} must be even.`,
    }
    Validator.extend('even', evenRule)

    const v1 = new Validator({ count: 4 }, { count: 'even' })
    expect(await v1.passes()).toBe(true)

    const v2 = new Validator({ count: 3 }, { count: 'even' })
    expect(await v2.fails()).toBe(true)
  })

  // ── Empty string vs null vs undefined ─────────────────────────────────

  test('empty string fails required, null fails required, undefined fails required', async () => {
    const v1 = new Validator({ name: '' }, { name: 'required' })
    expect(await v1.fails()).toBe(true)

    const v2 = new Validator({ name: null }, { name: 'required' })
    expect(await v2.fails()).toBe(true)

    const v3 = new Validator({ name: undefined }, { name: 'required' })
    expect(await v3.fails()).toBe(true)
  })

  // ── Multiple rules on same field ──────────────────────────────────────

  test('multiple rules: required|string|min:3|max:255', async () => {
    const v1 = new Validator({ name: 'ab' }, { name: 'required|string|min:3|max:255' })
    expect(await v1.fails()).toBe(true)
    const errors = v1.errors()
    expect(errors['name']!.some((e: string) => e.includes('at least 3'))).toBe(true)

    const v2 = new Validator({ name: 'abc' }, { name: 'required|string|min:3|max:255' })
    expect(await v2.passes()).toBe(true)
  })

  // ── Error accumulation ────────────────────────────────────────────────

  test('multiple fields fail: all errors returned', async () => {
    const v = new Validator(
      { email: '', age: 'not-a-number' },
      { email: 'required|email', age: 'required|integer' },
    )
    await v.fails()
    const errors = v.errors()
    expect(errors['email']).toBeDefined()
    expect(errors['age']).toBeDefined()
  })

  // ── stopOnFirstFailure mode ───────────────────────────────────────────

  test('stopOnFirstFailure stops after first field with error', async () => {
    const v = new Validator(
      { email: '', name: '' },
      { email: 'required', name: 'required' },
    )
    v.stopOnFirstFailure(true)
    await v.fails()
    const errors = v.errors()
    // Only the first field that was validated should have errors
    const errorKeys = Object.keys(errors)
    expect(errorKeys.length).toBe(1)
  })

  // ── Nested object validation ──────────────────────────────────────────

  test('nested object validation via dot notation', async () => {
    const data = {
      user: {
        profile: {
          bio: '',
        },
      },
    }
    const v = new Validator(data, { 'user.profile.bio': 'required|string|min:10' })
    expect(await v.fails()).toBe(true)
  })
})
