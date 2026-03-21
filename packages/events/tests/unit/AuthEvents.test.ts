// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { Registered, Lockout, Attempting, Authenticated, Login, Failed, Logout } from '@mantiq/auth'

describe('Auth Events', () => {
  it('creates Registered event with user', () => {
    const user = { getAuthIdentifier: () => 1, getAuthPassword: () => 'hash', getRememberToken: () => null, getRememberTokenName: () => 'token' }
    const event = new Registered(user)
    expect(event.user).toBe(user)
    expect(event.timestamp).toBeInstanceOf(Date)
  })

  it('creates Lockout event with request', () => {
    const request = { ip: '127.0.0.1', path: '/login' }
    const event = new Lockout(request)
    expect(event.request).toBe(request)
    expect(event.timestamp).toBeInstanceOf(Date)
  })

  it('creates Attempting event', () => {
    const event = new Attempting('web', { email: 'a@b.c' }, false)
    expect(event.guard).toBe('web')
    expect(event.credentials).toEqual({ email: 'a@b.c' })
    expect(event.remember).toBe(false)
  })

  it('creates Authenticated event', () => {
    const user = { getAuthIdentifier: () => 1, getAuthPassword: () => 'hash', getRememberToken: () => null, getRememberTokenName: () => 'token' }
    const event = new Authenticated('web', user)
    expect(event.guard).toBe('web')
    expect(event.user).toBe(user)
  })

  it('creates Login event', () => {
    const user = { getAuthIdentifier: () => 1, getAuthPassword: () => 'hash', getRememberToken: () => null, getRememberTokenName: () => 'token' }
    const event = new Login('web', user, true)
    expect(event.guard).toBe('web')
    expect(event.user).toBe(user)
    expect(event.remember).toBe(true)
  })

  it('creates Failed event', () => {
    const event = new Failed('web', { email: 'a@b.c' })
    expect(event.guard).toBe('web')
    expect(event.credentials).toEqual({ email: 'a@b.c' })
  })

  it('creates Logout event', () => {
    const event = new Logout('web', null)
    expect(event.guard).toBe('web')
    expect(event.user).toBeNull()
  })
})
