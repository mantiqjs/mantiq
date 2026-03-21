/**
 * Integration tests for database validation rules (exists/unique) with a
 * mock PresenceVerifier, FormRequest with a mock MantiqRequest, and complex
 * conditional rule combinations.
 *
 * Run: bun test packages/validation/tests/integration/database-rules.test.ts
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { Validator } from '../../src/Validator.ts'
import { FormRequest } from '../../src/FormRequest.ts'
import type { PresenceVerifier } from '../../src/contracts/PresenceVerifier.ts'
import type { MantiqRequest } from '@mantiq/core'
import { ValidationError, ForbiddenError } from '@mantiq/core'

// ── Mock PresenceVerifier ───────────────────────────────────────────────────

/**
 * In-memory presence verifier that simulates a database table.
 * Feed it rows and it counts matches like a real DB would.
 */
class MockPresenceVerifier implements PresenceVerifier {
  private tables: Record<string, Record<string, any>[]> = {}

  addTable(name: string, rows: Record<string, any>[]): void {
    this.tables[name] = rows
  }

  async getCount(
    table: string,
    column: string,
    value: any,
    excludeId?: string | number | null,
    idColumn: string = 'id',
    _extra?: [string, string, any][],
  ): Promise<number> {
    const rows = this.tables[table] ?? []
    return rows.filter((row) => {
      if (String(row[column]) !== String(value)) return false
      if (excludeId != null && String(row[idColumn]) === String(excludeId)) return false
      return true
    }).length
  }

  async getMultiCount(
    table: string,
    column: string,
    values: any[],
    _extra?: [string, string, any][],
  ): Promise<number> {
    const rows = this.tables[table] ?? []
    const strValues = values.map(String)
    return rows.filter((row) => strValues.includes(String(row[column]))).length
  }
}

// ── Mock MantiqRequest ──────────────────────────────────────────────────────

function createMockRequest(inputData: Record<string, any>, options?: {
  authenticated?: boolean
  user?: any
}): MantiqRequest {
  return {
    method: () => 'POST',
    path: () => '/test',
    url: () => '/test',
    fullUrl: () => 'http://localhost/test',
    query: (...args: any[]) => args.length === 0 ? {} as any : undefined as any,
    input: (...args: any[]) => {
      if (args.length === 0) return Promise.resolve(inputData) as any
      const [key, defaultValue] = args
      return Promise.resolve(inputData[key] ?? defaultValue) as any
    },
    only: (...keys: string[]) => {
      const result: Record<string, any> = {}
      for (const k of keys) if (k in inputData) result[k] = inputData[k]
      return Promise.resolve(result)
    },
    except: (...keys: string[]) => {
      const result = { ...inputData }
      for (const k of keys) delete result[k]
      return Promise.resolve(result)
    },
    has: (...keys: string[]) => keys.every((k) => k in inputData),
    filled: (...keys: string[]) => Promise.resolve(keys.every((k) => inputData[k] != null && inputData[k] !== '')),
    header: () => undefined,
    headers: () => ({}),
    cookie: () => undefined,
    setCookies: () => {},
    ip: () => '127.0.0.1',
    userAgent: () => 'test',
    accepts: () => false as const,
    expectsJson: () => true,
    isJson: () => true,
    file: () => null,
    files: () => [],
    hasFile: () => false,
    param: () => undefined,
    params: () => ({}),
    setRouteParams: () => {},
    session: () => { throw new Error('No session') },
    setSession: () => {},
    hasSession: () => false,
    user: () => options?.user ?? null,
    isAuthenticated: () => options?.authenticated ?? false,
    setUser: () => {},
    raw: () => new Request('http://localhost/test'),
  } as MantiqRequest
}

// ── Tests: exists & unique with PresenceVerifier ────────────────────────────

describe('Database Rules Integration', () => {
  let verifier: MockPresenceVerifier

  beforeEach(() => {
    verifier = new MockPresenceVerifier()
    verifier.addTable('users', [
      { id: 1, email: 'alice@example.com', username: 'alice' },
      { id: 2, email: 'bob@example.com', username: 'bob' },
      { id: 3, email: 'carol@example.com', username: 'carol' },
    ])
    verifier.addTable('roles', [
      { id: 1, name: 'admin' },
      { id: 2, name: 'editor' },
    ])
  })

  describe('exists rule', () => {
    test('passes when value exists in the table', async () => {
      const v = new Validator(
        { role_id: 1 },
        { role_id: 'required|exists:roles,id' },
      )
      v.setPresenceVerifier(verifier)

      const data = await v.validate()
      expect(data.role_id).toBe(1)
    })

    test('fails when value does not exist in the table', async () => {
      const v = new Validator(
        { role_id: 999 },
        { role_id: 'required|exists:roles,id' },
      )
      v.setPresenceVerifier(verifier)

      expect(await v.fails()).toBe(true)
      expect(v.errors().role_id).toContain('The selected role_id is invalid.')
    })

    test('defaults column to field name when column not specified', async () => {
      const v = new Validator(
        { email: 'alice@example.com' },
        { email: 'required|exists:users' },
      )
      v.setPresenceVerifier(verifier)

      const data = await v.validate()
      expect(data.email).toBe('alice@example.com')
    })

    test('fails for non-existent email with defaulted column', async () => {
      const v = new Validator(
        { email: 'nonexistent@example.com' },
        { email: 'required|exists:users' },
      )
      v.setPresenceVerifier(verifier)

      expect(await v.fails()).toBe(true)
    })

    test('skips validation when value is empty (nullable)', async () => {
      const v = new Validator(
        { role_id: null },
        { role_id: 'nullable|exists:roles,id' },
      )
      v.setPresenceVerifier(verifier)

      const data = await v.validate()
      expect(data.role_id).toBeNull()
    })

    test('throws when no presence verifier is set', async () => {
      const v = new Validator(
        { role_id: 1 },
        { role_id: 'exists:roles,id' },
      )

      expect(v.validate()).rejects.toThrow('A presence verifier is required')
    })

    test('throws when table parameter is missing', async () => {
      const v = new Validator(
        { role_id: 1 },
        { role_id: 'exists' },
      )
      v.setPresenceVerifier(verifier)

      expect(v.validate()).rejects.toThrow('The exists rule requires a table parameter')
    })
  })

  describe('unique rule', () => {
    test('passes when value is unique in the table', async () => {
      const v = new Validator(
        { email: 'new@example.com' },
        { email: 'required|unique:users,email' },
      )
      v.setPresenceVerifier(verifier)

      const data = await v.validate()
      expect(data.email).toBe('new@example.com')
    })

    test('fails when value already exists in the table', async () => {
      const v = new Validator(
        { email: 'alice@example.com' },
        { email: 'required|unique:users,email' },
      )
      v.setPresenceVerifier(verifier)

      expect(await v.fails()).toBe(true)
      expect(v.errors().email).toContain('The email has already been taken.')
    })

    test('passes when excluding a specific ID (update scenario)', async () => {
      // Simulating: updating user #1 while keeping the same email
      const v = new Validator(
        { email: 'alice@example.com' },
        { email: 'required|unique:users,email,1,id' },
      )
      v.setPresenceVerifier(verifier)

      const data = await v.validate()
      expect(data.email).toBe('alice@example.com')
    })

    test('fails when excluding a different ID but value is taken', async () => {
      // User #2 trying to use user #1's email
      const v = new Validator(
        { email: 'alice@example.com' },
        { email: 'required|unique:users,email,2,id' },
      )
      v.setPresenceVerifier(verifier)

      expect(await v.fails()).toBe(true)
    })

    test('defaults column to field name', async () => {
      const v = new Validator(
        { username: 'dave' },
        { username: 'required|unique:users' },
      )
      v.setPresenceVerifier(verifier)

      const data = await v.validate()
      expect(data.username).toBe('dave')
    })

    test('treats NULL excludeId as no exclusion', async () => {
      const v = new Validator(
        { email: 'alice@example.com' },
        { email: 'required|unique:users,email,NULL' },
      )
      v.setPresenceVerifier(verifier)

      expect(await v.fails()).toBe(true)
    })

    test('skips when value is empty (nullable)', async () => {
      const v = new Validator(
        { email: undefined },
        { email: 'nullable|unique:users,email' },
      )
      v.setPresenceVerifier(verifier)

      const data = await v.validate()
      expect(data.email).toBeUndefined()
    })
  })

  describe('exists + unique combined in multi-field validation', () => {
    test('validates multiple database rules across fields', async () => {
      const v = new Validator(
        { email: 'newuser@example.com', role_id: 1 },
        {
          email: 'required|email|unique:users,email',
          role_id: 'required|exists:roles,id',
        },
      )
      v.setPresenceVerifier(verifier)

      const data = await v.validate()
      expect(data.email).toBe('newuser@example.com')
      expect(data.role_id).toBe(1)
    })

    test('collects errors from multiple database rule failures', async () => {
      const v = new Validator(
        { email: 'alice@example.com', role_id: 999 },
        {
          email: 'required|email|unique:users,email',
          role_id: 'required|exists:roles,id',
        },
      )
      v.setPresenceVerifier(verifier)

      expect(await v.fails()).toBe(true)
      expect(v.errors().email).toHaveLength(1)
      expect(v.errors().role_id).toHaveLength(1)
    })
  })
})

// ── Tests: FormRequest with mock MantiqRequest ──────────────────────────────

describe('FormRequest Integration', () => {
  describe('basic FormRequest flow', () => {
    class StoreUserRequest extends FormRequest {
      override rules() {
        return {
          name: 'required|string|min:2|max:255',
          email: 'required|email',
          age: 'required|integer|min:0',
        }
      }
    }

    test('validate() returns validated data for valid input', async () => {
      const req = createMockRequest({ name: 'Alice', email: 'alice@test.com', age: 30 })
      const form = new StoreUserRequest(req)
      const data = await form.validate()

      expect(data.name).toBe('Alice')
      expect(data.email).toBe('alice@test.com')
      expect(data.age).toBe(30)
    })

    test('validate() throws ValidationError for invalid input', async () => {
      const req = createMockRequest({ name: '', email: 'not-email', age: -5 })
      const form = new StoreUserRequest(req)

      try {
        await form.validate()
        expect(true).toBe(false) // Should not reach
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        const ve = err as ValidationError
        expect(ve.errors.name).toBeDefined()
        expect(ve.errors.email).toBeDefined()
      }
    })

    test('errors are accessible on the form after failed validate()', async () => {
      const req = createMockRequest({ name: '', email: '' })
      const form = new StoreUserRequest(req)

      try {
        await form.validate()
      } catch {
        // expected
      }

      expect(form.errors.name).toBeDefined()
      expect(form.errors.email).toBeDefined()
      expect(form.errors.age).toBeDefined() // required
    })
  })

  describe('authorize()', () => {
    class AdminOnlyRequest extends FormRequest {
      override rules() {
        return { action: 'required|string' }
      }

      override authorize(): boolean {
        return this.request.isAuthenticated()
      }
    }

    test('throws ForbiddenError when authorize() returns false', async () => {
      const req = createMockRequest({ action: 'delete' }, { authenticated: false })
      const form = new AdminOnlyRequest(req)

      try {
        await form.validate()
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenError)
      }
    })

    test('proceeds with validation when authorize() returns true', async () => {
      const req = createMockRequest({ action: 'delete' }, { authenticated: true })
      const form = new AdminOnlyRequest(req)

      const data = await form.validate()
      expect(data.action).toBe('delete')
    })
  })

  describe('messages() and attributes()', () => {
    class CustomMessageRequest extends FormRequest {
      override rules() {
        return {
          name: 'required|string|min:3',
          email: 'required|email',
        }
      }

      override messages() {
        return {
          'name.required': 'Please provide your :attribute.',
          'name.min': 'Your :attribute must be at least :0 characters long.',
          'email': 'A valid :attribute address is required.',
        }
      }

      override attributes() {
        return {
          name: 'full name',
          email: 'email',
        }
      }
    }

    test('uses custom messages with attribute replacement', async () => {
      const req = createMockRequest({ name: '', email: 'bad' })
      const form = new CustomMessageRequest(req)

      try {
        await form.validate()
      } catch {
        // expected
      }

      expect(form.errors.name).toContain('Please provide your full name.')
      expect(form.errors.email).toContain('A valid email address is required.')
    })

    test('uses custom min message with param replacement', async () => {
      const req = createMockRequest({ name: 'ab', email: 'a@b.com' })
      const form = new CustomMessageRequest(req)

      try {
        await form.validate()
      } catch {
        // expected
      }

      expect(form.errors.name).toContain('Your full name must be at least 3 characters long.')
    })
  })

  describe('FormRequest with database rules via configureValidator', () => {
    let verifier: MockPresenceVerifier

    beforeEach(() => {
      verifier = new MockPresenceVerifier()
      verifier.addTable('users', [
        { id: 1, email: 'taken@example.com' },
      ])
    })

    class RegisterRequest extends FormRequest {
      constructor(req: MantiqRequest, private readonly verifier: PresenceVerifier) {
        super(req)
      }

      override rules() {
        return {
          email: 'required|email|unique:users,email',
          password: 'required|string|min:8|confirmed',
        }
      }

      protected override configureValidator(validator: Validator): void {
        validator.setPresenceVerifier(this.verifier)
      }
    }

    test('validates unique email through FormRequest', async () => {
      const req = createMockRequest({
        email: 'fresh@example.com',
        password: 'securepass',
        password_confirmation: 'securepass',
      })
      const form = new RegisterRequest(req, verifier)
      const data = await form.validate()

      expect(data.email).toBe('fresh@example.com')
      expect(data.password).toBe('securepass')
    })

    test('rejects taken email through FormRequest', async () => {
      const req = createMockRequest({
        email: 'taken@example.com',
        password: 'securepass',
        password_confirmation: 'securepass',
      })
      const form = new RegisterRequest(req, verifier)

      try {
        await form.validate()
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        expect((err as ValidationError).errors.email).toContain('The email has already been taken.')
      }
    })
  })
})

// ── Tests: Complex conditional rules ────────────────────────────────────────

describe('Complex Conditional Rules', () => {
  describe('required_if', () => {
    test('requires field when other field matches value', async () => {
      const v = new Validator(
        { type: 'business', company_name: '' },
        { company_name: 'required_if:type,business' },
      )

      expect(await v.fails()).toBe(true)
      expect(v.errors().company_name![0]).toContain('required when type is business')
    })

    test('does not require field when condition is not met', async () => {
      const v = new Validator(
        { type: 'personal' },
        { company_name: 'required_if:type,business' },
      )

      const data = await v.validate()
      expect(data).toBeDefined()
    })

    test('required_if with multiple possible values', async () => {
      const v = new Validator(
        { role: 'admin', reason: '' },
        { reason: 'required_if:role,admin,superadmin' },
      )

      expect(await v.fails()).toBe(true)
    })

    test('required_if passes when value is provided', async () => {
      const v = new Validator(
        { type: 'business', company_name: 'Acme Inc.' },
        { company_name: 'required_if:type,business|string|min:2' },
      )

      const data = await v.validate()
      expect(data.company_name).toBe('Acme Inc.')
    })
  })

  describe('required_unless', () => {
    test('requires field unless other field matches value', async () => {
      const v = new Validator(
        { subscription: 'free', payment_method: '' },
        { payment_method: 'required_unless:subscription,free' },
      )

      // subscription IS free, so payment_method is NOT required
      const data = await v.validate()
      expect(data).toBeDefined()
    })

    test('requires field when other field does not match any value', async () => {
      const v = new Validator(
        { subscription: 'premium', payment_method: '' },
        { payment_method: 'required_unless:subscription,free,trial' },
      )

      expect(await v.fails()).toBe(true)
      expect(v.errors().payment_method![0]).toContain('required unless subscription is')
    })
  })

  describe('required_with', () => {
    test('requires field when another field is present', async () => {
      const v = new Validator(
        { password: 'newpass' },
        { password_confirmation: 'required_with:password' },
      )

      expect(await v.fails()).toBe(true)
    })

    test('does not require field when related field is missing', async () => {
      const v = new Validator(
        {},
        { password_confirmation: 'required_with:password' },
      )

      const data = await v.validate()
      expect(data).toBeDefined()
    })
  })

  describe('required_without', () => {
    test('requires field when another field is absent', async () => {
      const v = new Validator(
        {},
        { email: 'required_without:phone', phone: 'required_without:email' },
      )

      expect(await v.fails()).toBe(true)
      expect(v.errors().email).toBeDefined()
      expect(v.errors().phone).toBeDefined()
    })

    test('does not require field when the other is present', async () => {
      // email is present, so required_without:email on phone does NOT trigger
      // phone is absent, so required_without:phone on email DOES trigger — but email has a value, so it passes
      const v = new Validator(
        { email: 'user@test.com' },
        { email: 'required_without:phone', phone: 'required_without:email' },
      )

      // phone is not required because email is present (not empty)
      expect(await v.fails()).toBe(false)
    })

    test('passes when both fields are provided', async () => {
      const v = new Validator(
        { email: 'user@test.com', phone: '1234567890' },
        { email: 'required_without:phone', phone: 'required_without:email' },
      )

      const data = await v.validate()
      expect(data.email).toBe('user@test.com')
      expect(data.phone).toBe('1234567890')
    })
  })

  describe('complex multi-rule combinations', () => {
    test('bail stops on first failure', async () => {
      const v = new Validator(
        { email: '' },
        { email: 'bail|required|email|min:5' },
      )

      expect(await v.fails()).toBe(true)
      // bail should stop after 'required' fails, so only 1 error
      expect(v.errors().email).toHaveLength(1)
    })

    test('nullable skips all rules when value is null', async () => {
      const v = new Validator(
        { nickname: null },
        { nickname: 'nullable|string|min:3|alpha' },
      )

      const data = await v.validate()
      expect(data.nickname).toBeNull()
    })

    test('sometimes skips validation when field is absent', async () => {
      const v = new Validator(
        { name: 'Alice' },
        {
          name: 'required|string',
          bio: 'sometimes|string|min:10',
        },
      )

      const data = await v.validate()
      expect(data.name).toBe('Alice')
      expect(data.bio).toBeUndefined()
    })

    test('sometimes validates when field IS present', async () => {
      const v = new Validator(
        { name: 'Alice', bio: 'short' },
        {
          name: 'required|string',
          bio: 'sometimes|string|min:10',
        },
      )

      expect(await v.fails()).toBe(true)
      expect(v.errors().bio).toBeDefined()
    })

    test('conditional + type + size rules combined', async () => {
      // Scenario: Creating an order. If payment type is 'card', card_number is required and must be 16 digits
      const v = new Validator(
        {
          payment_type: 'card',
          card_number: '1234567890123456',
          amount: 50,
        },
        {
          payment_type: 'required|in:card,cash,transfer',
          card_number: 'required_if:payment_type,card|string|size:16',
          amount: 'required|numeric|min:1',
        },
      )

      const data = await v.validate()
      expect(data.payment_type).toBe('card')
      expect(data.card_number).toBe('1234567890123456')
      expect(data.amount).toBe(50)
    })

    test('conditional + type + size rules — failure case', async () => {
      const v = new Validator(
        {
          payment_type: 'card',
          card_number: '1234', // too short
          amount: 0, // below min
        },
        {
          payment_type: 'required|in:card,cash,transfer',
          card_number: 'required_if:payment_type,card|string|size:16',
          amount: 'required|numeric|min:1',
        },
      )

      expect(await v.fails()).toBe(true)
      expect(v.errors().card_number).toBeDefined()
      expect(v.errors().amount).toBeDefined()
    })

    test('wildcard field expansion with conditional rules', async () => {
      const v = new Validator(
        {
          items: [
            { name: 'Widget', qty: 5 },
            { name: '', qty: 0 },
          ],
        },
        {
          'items.*.name': 'required|string|min:1',
          'items.*.qty': 'required|integer|min:1',
        },
      )

      expect(await v.fails()).toBe(true)
      expect(v.errors()['items.1.name']).toBeDefined()
      expect(v.errors()['items.1.qty']).toBeDefined()
      // First item should be valid
      expect(v.errors()['items.0.name']).toBeUndefined()
      expect(v.errors()['items.0.qty']).toBeUndefined()
    })

    test('stopOnFirstFailure halts after first field with errors', async () => {
      const v = new Validator(
        { name: '', email: 'bad', age: -1 },
        {
          name: 'required|string',
          email: 'required|email',
          age: 'required|integer|min:0',
        },
      )
      v.stopOnFirstFailure()

      expect(await v.fails()).toBe(true)
      // Only the first failing field should have errors
      const errorKeys = Object.keys(v.errors())
      expect(errorKeys).toHaveLength(1)
      expect(errorKeys[0]).toBe('name')
    })

    test('confirmed rule with real data', async () => {
      const passing = new Validator(
        { password: 'secret123', password_confirmation: 'secret123' },
        { password: 'required|string|min:6|confirmed' },
      )
      const data = await passing.validate()
      expect(data.password).toBe('secret123')

      const failing = new Validator(
        { password: 'secret123', password_confirmation: 'different' },
        { password: 'required|string|min:6|confirmed' },
      )
      expect(await failing.fails()).toBe(true)
      expect(failing.errors().password![0]).toContain('confirmation does not match')
    })

    test('database rules combined with conditional and type rules', async () => {
      const verifier = new MockPresenceVerifier()
      verifier.addTable('categories', [
        { id: 1, slug: 'tech' },
        { id: 2, slug: 'sports' },
      ])

      const v = new Validator(
        {
          title: 'My Article',
          category_id: 1,
          is_featured: true,
          featured_image: '', // required if is_featured
        },
        {
          title: 'required|string|min:5|max:200',
          category_id: 'required|integer|exists:categories,id',
          is_featured: 'required|boolean',
          featured_image: 'required_if:is_featured,true|string|url',
        },
      )
      v.setPresenceVerifier(verifier)

      expect(await v.fails()).toBe(true)
      // category_id exists, title is valid, but featured_image is required when is_featured is true
      expect(v.errors().title).toBeUndefined()
      expect(v.errors().category_id).toBeUndefined()
      expect(v.errors().featured_image).toBeDefined()
    })
  })
})
