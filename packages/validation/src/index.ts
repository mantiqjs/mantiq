// @mantiq/validation — public API exports

// ── Contracts ────────────────────────────────────────────────────────────────
export type { Rule, ValidationContext } from './contracts/Rule.ts'
export type { PresenceVerifier } from './contracts/PresenceVerifier.ts'

// ── Core ─────────────────────────────────────────────────────────────────────
export { Validator, type RuleDefinition } from './Validator.ts'
export { FormRequest } from './FormRequest.ts'

// ── Rules ────────────────────────────────────────────────────────────────────
export { builtinRules } from './rules/builtin.ts'
export {
  // Presence
  required, nullable, present, filled,
  requiredIf, requiredUnless, requiredWith, requiredWithout,
  // Types
  string, numeric, integer, boolean, array, object,
  // Size
  min, max, between, size,
  // String
  email, url, uuid, regex, alpha, alphaNum, alphaDash,
  startsWith, endsWith, lowercase, uppercase,
  // Comparison
  confirmed, same, different, gt, gte, lt, lte,
  // Inclusion
  inRule, notIn,
  // Date
  date, before, after,
  // Special
  ip, json,
  // Database
  exists, unique,
} from './rules/builtin.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────
export { validate, setPresenceVerifier, getPresenceVerifier } from './helpers/validate.ts'

// ── Presence Verifier ────────────────────────────────────────────────────────
export { DatabasePresenceVerifier } from './DatabasePresenceVerifier.ts'

// ── Service Provider ─────────────────────────────────────────────────────────
export { ValidationServiceProvider, PRESENCE_VERIFIER } from './ValidationServiceProvider.ts'
