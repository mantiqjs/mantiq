import { describe, test, expect } from 'bun:test'
import { FormRequest } from '../../src/FormRequest.ts'
import { ValidationError, ForbiddenError } from '@mantiq/core'

// ── Minimal MantiqRequest mock ──────────────────────────────────────────────

function mockRequest(body: Record<string, any> = {}): any {
  return {
    input: async () => body,
    method: () => 'POST',
    path: () => '/test',
    user: () => null,
    isAuthenticated: () => false,
  }
}

// ── Test form requests ──────────────────────────────────────────────────────

class CreateUserRequest extends FormRequest {
  rules() {
    return {
      name: 'required|string|min:2|max:255',
      email: 'required|email',
      age: 'nullable|integer|min:0',
    }
  }

  messages() {
    return {
      'name.required': 'We need your name!',
      'email.required': 'Email is absolutely required.',
    }
  }

  attributes() {
    return {
      email: 'email address',
    }
  }
}

class AuthorizedOnlyRequest extends FormRequest {
  rules() {
    return { name: 'required' }
  }

  authorize() {
    return this.request.isAuthenticated()
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('FormRequest', () => {
  test('returns validated data on success', async () => {
    const req = new CreateUserRequest(mockRequest({ name: 'Alice', email: 'alice@example.com', age: 25, extra: 'ignored' }))
    const data = await req.validate()
    expect(data.name).toBe('Alice')
    expect(data.email).toBe('alice@example.com')
    expect(data.age).toBe(25)
    expect(data.extra).toBeUndefined()
  })

  test('throws ValidationError on failure', async () => {
    const req = new CreateUserRequest(mockRequest({ name: '', email: 'bad' }))
    try {
      await req.validate()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      const err = e as ValidationError
      expect(err.errors.name![0]).toBe('We need your name!')
      expect(err.errors.email![0]).toContain('valid email')
    }
  })

  test('throws ForbiddenError when not authorized', async () => {
    const req = new AuthorizedOnlyRequest(mockRequest({ name: 'Alice' }))
    await expect(req.validate()).rejects.toThrow(ForbiddenError)
  })

  test('passes authorization when authenticated', async () => {
    const authenticatedRequest: any = {
      ...mockRequest({ name: 'Alice' }),
      isAuthenticated: () => true,
    }
    const req = new AuthorizedOnlyRequest(authenticatedRequest)
    const data = await req.validate()
    expect(data.name).toBe('Alice')
  })

  test('nullable fields accept null', async () => {
    const req = new CreateUserRequest(mockRequest({ name: 'Alice', email: 'alice@example.com', age: null }))
    const data = await req.validate()
    expect(data.age).toBeNull()
  })

  test('exposes errors after failed validation', async () => {
    const req = new CreateUserRequest(mockRequest({}))
    try {
      await req.validate()
    } catch {
      // expected
    }
    expect(req.errors.name).toBeDefined()
    expect(req.errors.email).toBeDefined()
  })
})
