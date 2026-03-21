/**
 * Base class for authorization policies.
 *
 * Subclass and define methods matching ability names.
 * Each method receives the user + optional model arguments and returns
 * a boolean or AuthorizationResponse.
 *
 * The optional `before()` hook is called before any policy method and
 * can short-circuit the check: return `true` to allow, `false` to deny,
 * or `null`/`undefined` to continue to the actual policy method.
 */
export abstract class Policy {
  /**
   * Called before any policy method.
   * Return true to allow, false to deny, null/undefined to continue.
   */
  before?(user: any, ability: string, ...args: any[]): boolean | null | undefined | Promise<boolean | null | undefined>
}
