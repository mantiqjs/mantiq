/**
 * Controls which users/roles can access which AI models.
 *
 * @example
 *   const policy = new ModelPolicy()
 *   policy.allow('gpt-4o', (user) => user.plan === 'pro')
 *   policy.deny('gpt-4-turbo')
 *
 *   if (!policy.can(currentUser, 'gpt-4o')) {
 *     throw new Error('Upgrade to Pro to use GPT-4o')
 *   }
 */
export class ModelPolicy {
  private rules = new Map<string, (user: any) => boolean>()
  private denied = new Set<string>()
  private defaultAllow = true

  /** Allow a model when the check passes. */
  allow(model: string, check: (user: any) => boolean): void {
    this.denied.delete(model)
    this.rules.set(model, check)
  }

  /** Deny a model entirely. */
  deny(model: string): void {
    this.denied.add(model)
    this.rules.delete(model)
  }

  /** Set the default policy for models without explicit rules. */
  setDefault(allow: boolean): void {
    this.defaultAllow = allow
  }

  /** Check if a user can use a model. */
  can(user: any, model: string): boolean {
    if (this.denied.has(model)) return false

    const rule = this.rules.get(model)
    if (rule) return rule(user)

    // Check prefix matches (e.g., 'gpt-4' matches 'gpt-4o', 'gpt-4-turbo')
    for (const [key, check] of this.rules) {
      if (model.startsWith(key)) return check(user)
    }

    return this.defaultAllow
  }

  /** List all configured model rules. */
  listRules(): { model: string; type: 'allow' | 'deny' }[] {
    const result: { model: string; type: 'allow' | 'deny' }[] = []
    for (const model of this.denied) {
      result.push({ model, type: 'deny' })
    }
    for (const model of this.rules.keys()) {
      result.push({ model, type: 'allow' })
    }
    return result
  }
}
