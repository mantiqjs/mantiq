import { Validator, type RuleDefinition } from '../Validator.ts'
import type { PresenceVerifier } from '../contracts/PresenceVerifier.ts'

/** Global presence verifier — set by ValidationServiceProvider. */
let _globalVerifier: PresenceVerifier | null = null

export function setPresenceVerifier(verifier: PresenceVerifier): void {
  _globalVerifier = verifier
}

export function getPresenceVerifier(): PresenceVerifier | null {
  return _globalVerifier
}

/**
 * Validate data against rules. Returns validated data or throws ValidationError.
 *
 * @example
 *   const data = await validate(
 *     { name: 'Alice', email: 'alice@example.com' },
 *     { name: 'required|string|max:255', email: 'required|email|unique:users,email' },
 *   )
 */
export async function validate(
  data: Record<string, any>,
  rules: Record<string, RuleDefinition>,
  messages?: Record<string, string>,
  attributes?: Record<string, string>,
): Promise<Record<string, any>> {
  const validator = new Validator(data, rules, messages, attributes)
  if (_globalVerifier) {
    validator.setPresenceVerifier(_globalVerifier)
  }
  return validator.validate()
}
