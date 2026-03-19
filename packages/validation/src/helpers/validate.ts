import { Validator, type RuleDefinition } from '../Validator.ts'

/**
 * Validate data against rules. Returns validated data or throws ValidationError.
 *
 * @example
 *   const data = await validate(
 *     { name: 'Alice', email: 'alice@example.com' },
 *     { name: 'required|string|max:255', email: 'required|email' },
 *   )
 */
export async function validate(
  data: Record<string, any>,
  rules: Record<string, RuleDefinition>,
  messages?: Record<string, string>,
  attributes?: Record<string, string>,
): Promise<Record<string, any>> {
  return new Validator(data, rules, messages, attributes).validate()
}
