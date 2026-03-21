import { ServiceProvider } from '@mantiq/core'
import { Validator } from './Validator.ts'
import { DatabasePresenceVerifier } from './DatabasePresenceVerifier.ts'
import { setPresenceVerifier } from './helpers/validate.ts'
import type { Rule } from './contracts/Rule.ts'
import type { PresenceVerifier } from './contracts/PresenceVerifier.ts'

export const PRESENCE_VERIFIER = Symbol('PresenceVerifier')

/**
 * Registers validation-related bindings in the container.
 *
 * Automatically wires up DatabasePresenceVerifier for `exists` and `unique`
 * rules when @mantiq/database is available.
 */
export class ValidationServiceProvider extends ServiceProvider {
  override register(): void {
    // Bind a factory that creates pre-configured Validators
    this.app.bind('validator', () => {
      return (
        data: Record<string, any>,
        rules: Record<string, string | (string | Rule)[]>,
        messages?: Record<string, string>,
        attributes?: Record<string, string>,
      ) => {
        const validator = new Validator(data, rules, messages, attributes)
        try {
          const verifier = this.app.make<PresenceVerifier>(PRESENCE_VERIFIER)
          validator.setPresenceVerifier(verifier)
        } catch {
          // No presence verifier bound
        }
        return validator
      }
    })
  }

  override async boot(): Promise<void> {
    // Auto-wire DatabasePresenceVerifier using the default DB connection
    try {
      const { DatabaseManager } = await import('@mantiq/database')
      const dbManager = this.app.make(DatabaseManager)
      const verifier = new DatabasePresenceVerifier(dbManager.connection())

      // Register in container for validator factory
      this.app.singleton(PRESENCE_VERIFIER, () => verifier)

      // Set globally for the validate() helper function
      setPresenceVerifier(verifier)
    } catch {
      // @mantiq/database not installed — unique/exists rules unavailable
    }
  }
}
