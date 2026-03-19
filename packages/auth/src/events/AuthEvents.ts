import { Event } from '@mantiq/core'
import type { Authenticatable } from '../contracts/Authenticatable.ts'

/**
 * Fired when an authentication attempt begins.
 */
export class Attempting extends Event {
  constructor(
    public readonly guard: string,
    public readonly credentials: Record<string, any>,
    public readonly remember: boolean,
  ) {
    super()
  }
}

/**
 * Fired when a user is successfully authenticated (session or remember cookie).
 */
export class Authenticated extends Event {
  constructor(
    public readonly guard: string,
    public readonly user: Authenticatable,
  ) {
    super()
  }
}

/**
 * Fired when a user logs in via attempt() or login().
 */
export class Login extends Event {
  constructor(
    public readonly guard: string,
    public readonly user: Authenticatable,
    public readonly remember: boolean,
  ) {
    super()
  }
}

/**
 * Fired when an authentication attempt fails (wrong credentials).
 */
export class Failed extends Event {
  constructor(
    public readonly guard: string,
    public readonly credentials: Record<string, any>,
  ) {
    super()
  }
}

/**
 * Fired when a user logs out.
 */
export class Logout extends Event {
  constructor(
    public readonly guard: string,
    public readonly user: Authenticatable | null,
  ) {
    super()
  }
}

/**
 * Fired when a new user registers.
 */
export class Registered extends Event {
  constructor(
    public readonly user: Authenticatable,
  ) {
    super()
  }
}

/**
 * Fired when a user is locked out due to too many failed attempts.
 */
export class Lockout extends Event {
  constructor(
    public readonly request: any,
  ) {
    super()
  }
}
