import { ForbiddenError } from '@mantiq/core'
import { AuthorizationResponse } from './AuthorizationResponse.ts'
import type { Policy } from './Policy.ts'
import { UserGate } from './UserGate.ts'

type GateCallback = (user: any, ...args: any[]) => boolean | AuthorizationResponse | Promise<boolean | AuthorizationResponse>
type BeforeCallback = (user: any, ability: string, ...args: any[]) => boolean | null | undefined | Promise<boolean | null | undefined>
type AfterCallback = (user: any, ability: string, result: boolean, ...args: any[]) => void | Promise<void>

/**
 * Central authorization manager — Laravel-style Gates & Policies.
 *
 * Gate closures handle simple ability checks.
 * Policies handle model-based authorization — each policy maps to a model class.
 *
 * Resolution order:
 * 1. Global `before` callbacks (short-circuit on non-null)
 * 2. Policy `before()` hook (if a policy matches)
 * 3. Policy method matching the ability name
 * 4. Gate closure matching the ability name
 * 5. Deny by default
 * 6. Global `after` callbacks (for auditing, cannot change result)
 */
export class GateManager {
  private gates = new Map<string, GateCallback>()
  private policies = new Map<any, new () => Policy>()
  private beforeCallbacks: BeforeCallback[] = []
  private afterCallbacks: AfterCallback[] = []

  // ── Registration ─────────────────────────────────────────────────────────

  /**
   * Define a gate closure for the given ability.
   */
  define(ability: string, callback: GateCallback): this {
    this.gates.set(ability, callback)
    return this
  }

  /**
   * Register a policy class for a model constructor.
   */
  policy(modelClass: any, policyClass: new () => Policy): this {
    this.policies.set(modelClass, policyClass)
    return this
  }

  /**
   * Register a global before callback.
   * If the callback returns `true` or `false`, the check short-circuits.
   * Return `null` or `undefined` to continue to the gate/policy check.
   */
  before(callback: BeforeCallback): this {
    this.beforeCallbacks.push(callback)
    return this
  }

  /**
   * Register a global after callback (for logging/auditing).
   * After callbacks cannot change the authorization result.
   */
  after(callback: AfterCallback): this {
    this.afterCallbacks.push(callback)
    return this
  }

  // ── Checking ─────────────────────────────────────────────────────────────

  /**
   * Check if the given ability is allowed for the user.
   */
  async allows(ability: string, user: any, ...args: any[]): Promise<boolean> {
    const response = await this.resolve(ability, user, ...args)
    return response.allowed()
  }

  /**
   * Check if the given ability is denied for the user.
   */
  async denies(ability: string, user: any, ...args: any[]): Promise<boolean> {
    return !(await this.allows(ability, user, ...args))
  }

  /**
   * Authorize the ability or throw ForbiddenError.
   * Returns the AuthorizationResponse if allowed.
   */
  async authorize(ability: string, user: any, ...args: any[]): Promise<AuthorizationResponse> {
    const response = await this.resolve(ability, user, ...args)

    if (response.denied()) {
      throw new ForbiddenError(response.message() ?? 'This action is unauthorized.')
    }

    return response
  }

  /**
   * Check multiple abilities — all must pass.
   */
  async check(abilities: string[], user: any, ...args: any[]): Promise<boolean> {
    for (const ability of abilities) {
      if (!(await this.allows(ability, user, ...args))) {
        return false
      }
    }
    return true
  }

  /**
   * Check multiple abilities — at least one must pass.
   */
  async any(abilities: string[], user: any, ...args: any[]): Promise<boolean> {
    for (const ability of abilities) {
      if (await this.allows(ability, user, ...args)) {
        return true
      }
    }
    return false
  }

  /**
   * Returns a UserGate scoped to a specific user for convenience.
   */
  forUser(user: any): UserGate {
    return new UserGate(this, user)
  }

  // ── Policy resolution ──────────────────────────────────────────────────

  /**
   * Resolve the policy class for a given model instance.
   * Returns null if no policy is registered for this model's constructor.
   */
  getPolicyFor(model: any): Policy | null {
    if (model === null || model === undefined) return null

    const constructor = model.constructor
    const PolicyClass = this.policies.get(constructor)

    if (!PolicyClass) return null
    return new PolicyClass()
  }

  // ── Internal resolution ────────────────────────────────────────────────

  /**
   * Core resolution logic.
   */
  private async resolve(ability: string, user: any, ...args: any[]): Promise<AuthorizationResponse> {
    // 1. Run global before callbacks
    for (const cb of this.beforeCallbacks) {
      const result = await cb(user, ability, ...args)
      if (result === true) {
        const response = AuthorizationResponse.allow()
        await this.runAfterCallbacks(user, ability, true, ...args)
        return response
      }
      if (result === false) {
        const response = AuthorizationResponse.deny()
        await this.runAfterCallbacks(user, ability, false, ...args)
        return response
      }
      // null/undefined → continue
    }

    // 2. Try policy-based authorization
    const firstArg = args[0]
    const policyResult = await this.tryPolicy(ability, user, firstArg, ...args)
    if (policyResult !== null) {
      const allowed = policyResult.allowed()
      await this.runAfterCallbacks(user, ability, allowed, ...args)
      return policyResult
    }

    // 3. Try gate closure
    const gateResult = await this.tryGate(ability, user, ...args)
    if (gateResult !== null) {
      const allowed = gateResult.allowed()
      await this.runAfterCallbacks(user, ability, allowed, ...args)
      return gateResult
    }

    // 4. Deny by default
    const denied = AuthorizationResponse.deny()
    await this.runAfterCallbacks(user, ability, false, ...args)
    return denied
  }

  /**
   * Attempt policy-based authorization.
   * Returns null if no matching policy or method.
   */
  private async tryPolicy(ability: string, user: any, firstArg: any, ...allArgs: any[]): Promise<AuthorizationResponse | null> {
    if (firstArg === null || firstArg === undefined) return null

    const policy = this.getPolicyFor(firstArg)
    if (!policy) return null

    // Policy before() hook
    if (typeof policy.before === 'function') {
      const beforeResult = await policy.before(user, ability, ...allArgs)
      if (beforeResult === true) return AuthorizationResponse.allow()
      if (beforeResult === false) return AuthorizationResponse.deny()
      // null/undefined → continue to method
    }

    // Check if the policy has a method matching the ability name
    const method = (policy as any)[ability]
    if (typeof method !== 'function') {
      // Policy exists but no matching method → deny
      return AuthorizationResponse.deny(`Policy method "${ability}" not defined.`)
    }

    const result = await method.call(policy, user, ...allArgs)
    return this.normalizeResult(result)
  }

  /**
   * Attempt gate closure authorization.
   * Returns null if no gate is defined for this ability.
   */
  private async tryGate(ability: string, user: any, ...args: any[]): Promise<AuthorizationResponse | null> {
    const callback = this.gates.get(ability)
    if (!callback) return null

    const result = await callback(user, ...args)
    return this.normalizeResult(result)
  }

  /**
   * Normalize a boolean or AuthorizationResponse return value.
   */
  private normalizeResult(result: boolean | AuthorizationResponse): AuthorizationResponse {
    if (result instanceof AuthorizationResponse) return result
    return result ? AuthorizationResponse.allow() : AuthorizationResponse.deny()
  }

  /**
   * Run all global after callbacks.
   */
  private async runAfterCallbacks(user: any, ability: string, result: boolean, ...args: any[]): Promise<void> {
    for (const cb of this.afterCallbacks) {
      await cb(user, ability, result, ...args)
    }
  }
}
