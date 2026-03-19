import type { MantiqRequest } from '@mantiq/core'
import type { Authenticatable } from './Authenticatable.ts'

/**
 * Base guard contract — read-only authentication checks.
 */
export interface Guard {
  /** Determine if the current user is authenticated. */
  check(): Promise<boolean>

  /** Determine if the current user is a guest. */
  guest(): Promise<boolean>

  /** Get the currently authenticated user. */
  user(): Promise<Authenticatable | null>

  /** Get the ID of the currently authenticated user. */
  id(): Promise<string | number | null>

  /** Validate credentials without logging in. */
  validate(credentials: Record<string, any>): Promise<boolean>

  /** Set the current user explicitly. */
  setUser(user: Authenticatable): void

  /** Check if a user instance is already resolved (without hitting provider). */
  hasUser(): boolean

  /** Set the current request on the guard (resets per-request state). */
  setRequest(request: MantiqRequest): void
}
