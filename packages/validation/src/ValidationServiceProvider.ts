import { ServiceProvider } from '@mantiq/core'
import { Validator } from './Validator.ts'
import type { Rule } from './contracts/Rule.ts'
import type { PresenceVerifier } from './contracts/PresenceVerifier.ts'

export const PRESENCE_VERIFIER = Symbol('PresenceVerifier')

/**
 * Registers validation-related bindings in the container.
 *
 * @example
 *   // In your app bootstrap:
 *   app.register(new ValidationServiceProvider(app))
 *
 *   // To enable database rules (exists, unique), also bind a PresenceVerifier:
 *   app.singleton(PRESENCE_VERIFIER, () => new DatabasePresenceVerifier(db))
 */
export class ValidationServiceProvider extends ServiceProvider {
  register(): void {
    // Bind a factory that creates pre-configured Validators
    this.app.bind('validator', () => {
      return (
        data: Record<string, any>,
        rules: Record<string, string | (string | Rule)[]>,
        messages?: Record<string, string>,
        attributes?: Record<string, string>,
      ) => {
        const validator = new Validator(data, rules, messages, attributes)
        // Auto-attach presence verifier if one is bound
        try {
          const verifier = this.app.make<PresenceVerifier>(PRESENCE_VERIFIER)
          validator.setPresenceVerifier(verifier)
        } catch {
          // No presence verifier bound — database rules will throw if used
        }
        return validator
      }
    })
  }
}
