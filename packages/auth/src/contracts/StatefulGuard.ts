import type { Guard } from './Guard.ts'
import type { Authenticatable } from './Authenticatable.ts'

/**
 * Contract for stateful (session-based) guards that support login/logout.
 */
export interface StatefulGuard extends Guard {
  /** Attempt to authenticate using credentials. Returns true on success. */
  attempt(credentials: Record<string, any>, remember?: boolean): Promise<boolean>

  /** Log a user in (set session, optionally set remember cookie). */
  login(user: Authenticatable, remember?: boolean): Promise<void>

  /** Log a user in by their identifier. */
  loginUsingId(id: string | number, remember?: boolean): Promise<Authenticatable | null>

  /** Log the user out (flush session, clear remember cookie). */
  logout(): Promise<void>

  /** Determine if the user was authenticated via remember me cookie. */
  viaRemember(): boolean
}
