import type { Rule } from '../contracts/Rule.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function isEmpty(v: any): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
}

function getSize(v: any): number {
  if (typeof v === 'string' || Array.isArray(v)) return v.length
  if (typeof v === 'number') return v
  return 0
}

function getNestedValue(data: Record<string, any>, path: string): any {
  return path.split('.').reduce((obj, key) => obj?.[key], data)
}

/**
 * Validate an IPv6 address string, including compressed (::) notation.
 */
function isValidIPv6(s: string): boolean {
  // Must only contain hex digits and colons
  if (!/^[0-9a-fA-F:]+$/.test(s)) return false

  // Handle :: compression — only one :: is allowed
  const doubleColonCount = (s.match(/::/g) || []).length
  if (doubleColonCount > 1) return false

  if (doubleColonCount === 1) {
    const parts = s.split('::')
    const left = parts[0] === '' ? [] : parts[0]!.split(':')
    const right = parts[1] === '' ? [] : parts[1]!.split(':')
    const totalGroups = left.length + right.length
    if (totalGroups > 7) return false
    return [...left, ...right].every((g) => g.length >= 1 && g.length <= 4)
  }

  // No compression — must have exactly 8 groups
  const groups = s.split(':')
  if (groups.length !== 8) return false
  return groups.every((g) => g.length >= 1 && g.length <= 4)
}

// ── Presence rules ───────────────────────────────────────────────────────────

export const required: Rule = {
  name: 'required',
  validate: (v, field) => !isEmpty(v) || `The ${field} field is required.`,
}

export const nullable: Rule = {
  name: 'nullable',
  validate: () => true, // marker rule — handled by Validator
}

export const present: Rule = {
  name: 'present',
  validate: (v, field, data) =>
    field in data || `The ${field} field must be present.`,
}

export const filled: Rule = {
  name: 'filled',
  validate: (v, field, data) =>
    !(field in data) || !isEmpty(v) || `The ${field} field must not be empty when present.`,
}

// ── Conditional presence ─────────────────────────────────────────────────────

export const requiredIf: Rule = {
  name: 'required_if',
  validate: (v, field, data, [otherField, ...values]) => {
    const other = getNestedValue(data, otherField!)
    if (values.includes(String(other))) {
      return !isEmpty(v) || `The ${field} field is required when ${otherField} is ${values.join(', ')}.`
    }
    return true
  },
}

export const requiredUnless: Rule = {
  name: 'required_unless',
  validate: (v, field, data, [otherField, ...values]) => {
    const other = getNestedValue(data, otherField!)
    if (!values.includes(String(other))) {
      return !isEmpty(v) || `The ${field} field is required unless ${otherField} is ${values.join(', ')}.`
    }
    return true
  },
}

export const requiredWith: Rule = {
  name: 'required_with',
  validate: (v, field, data, params) => {
    const anyPresent = params.some((p) => !isEmpty(getNestedValue(data, p)))
    if (anyPresent) return !isEmpty(v) || `The ${field} field is required when ${params.join(', ')} is present.`
    return true
  },
}

export const requiredWithout: Rule = {
  name: 'required_without',
  validate: (v, field, data, params) => {
    const anyMissing = params.some((p) => isEmpty(getNestedValue(data, p)))
    if (anyMissing) return !isEmpty(v) || `The ${field} field is required when ${params.join(', ')} is not present.`
    return true
  },
}

// ── Type rules ───────────────────────────────────────────────────────────────

export const string: Rule = {
  name: 'string',
  validate: (v, field) =>
    isEmpty(v) || typeof v === 'string' || `The ${field} field must be a string.`,
}

export const numeric: Rule = {
  name: 'numeric',
  validate: (v, field) => {
    if (isEmpty(v)) return true
    // Reject booleans, objects, arrays — only accept numbers and numeric strings
    if (typeof v === 'boolean' || typeof v === 'object') {
      return `The ${field} field must be a number.`
    }
    return (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) || `The ${field} field must be a number.`
  },
}

export const integer: Rule = {
  name: 'integer',
  validate: (v, field) => {
    if (isEmpty(v)) return true
    if (typeof v === 'boolean' || typeof v === 'object') {
      return `The ${field} field must be an integer.`
    }
    return Number.isInteger(typeof v === 'string' ? Number(v) : v) || `The ${field} field must be an integer.`
  },
}

export const boolean: Rule = {
  name: 'boolean',
  validate: (v, field) =>
    isEmpty(v) || [true, false, 0, 1, '0', '1', 'true', 'false'].includes(v) || `The ${field} field must be true or false.`,
}

export const array: Rule = {
  name: 'array',
  validate: (v, field) =>
    isEmpty(v) || Array.isArray(v) || `The ${field} field must be an array.`,
}

export const object: Rule = {
  name: 'object',
  validate: (v, field) =>
    isEmpty(v) || (typeof v === 'object' && v !== null && !Array.isArray(v)) || `The ${field} field must be an object.`,
}

// ── Size rules ───────────────────────────────────────────────────────────────

export const min: Rule = {
  name: 'min',
  validate: (v, field, _data, [param]) => {
    if (isEmpty(v)) return true
    const limit = Number(param)
    const size = getSize(v)
    if (typeof v === 'string' || Array.isArray(v))
      return size >= limit || `The ${field} field must be at least ${limit} characters.`
    return size >= limit || `The ${field} field must be at least ${limit}.`
  },
}

export const max: Rule = {
  name: 'max',
  validate: (v, field, _data, [param]) => {
    if (isEmpty(v)) return true
    const limit = Number(param)
    const size = getSize(v)
    if (typeof v === 'string' || Array.isArray(v))
      return size <= limit || `The ${field} field must not be greater than ${limit} characters.`
    return size <= limit || `The ${field} field must not be greater than ${limit}.`
  },
}

export const between: Rule = {
  name: 'between',
  validate: (v, field, _data, [lo, hi]) => {
    if (isEmpty(v)) return true
    const size = getSize(v)
    return (size >= Number(lo) && size <= Number(hi)) || `The ${field} field must be between ${lo} and ${hi}.`
  },
}

export const size: Rule = {
  name: 'size',
  validate: (v, field, _data, [param]) => {
    if (isEmpty(v)) return true
    const expected = Number(param)
    return getSize(v) === expected || `The ${field} field must be ${expected}.`
  },
}

// ── String rules ─────────────────────────────────────────────────────────────

export const email: Rule = {
  name: 'email',
  validate: (v, field) =>
    isEmpty(v) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) || `The ${field} field must be a valid email address.`,
}

export const url: Rule = {
  name: 'url',
  validate: (v, field) => {
    if (isEmpty(v)) return true
    try { new URL(String(v)); return true } catch { return `The ${field} field must be a valid URL.` }
  },
}

export const uuid: Rule = {
  name: 'uuid',
  validate: (v, field) =>
    isEmpty(v) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v)) || `The ${field} field must be a valid UUID.`,
}

/**
 * Detect patterns prone to catastrophic backtracking (ReDoS).
 * Rejects nested quantifiers like (a+)+, (a*)+, (a+)*, (.+)+ etc. (#177)
 */
function hasNestedQuantifiers(pattern: string): boolean {
  // Matches a group followed by a quantifier that itself contains a quantifier
  return /(\([^)]*[+*][^)]*\))[+*{]/.test(pattern) ||
         /(\[[^\]]*\])[+*{]\)?[+*{]/.test(pattern)
}

export const regex: Rule = {
  name: 'regex',
  validate: (v, field, _data, [pattern]) => {
    if (isEmpty(v)) return true
    try {
      const match = pattern!.match(/^\/(.+)\/([gimsuy]*)$/)
      const rawPattern = match ? match[1]! : pattern!

      // Security: reject patterns with nested quantifiers to prevent ReDoS (#177)
      if (hasNestedQuantifiers(rawPattern)) {
        return `The ${field} field format is invalid.`
      }

      const re = match ? new RegExp(match[1]!, match[2]) : new RegExp(pattern!)
      return re.test(String(v)) || `The ${field} field format is invalid.`
    } catch {
      // Invalid regex pattern (syntax error) — treat as validation failure
      return `The ${field} field format is invalid.`
    }
  },
}

export const alpha: Rule = {
  name: 'alpha',
  validate: (v, field) =>
    isEmpty(v) || /^[a-zA-Z]+$/.test(String(v)) || `The ${field} field must only contain letters.`,
}

export const alphaNum: Rule = {
  name: 'alpha_num',
  validate: (v, field) =>
    isEmpty(v) || /^[a-zA-Z0-9]+$/.test(String(v)) || `The ${field} field must only contain letters and numbers.`,
}

export const alphaDash: Rule = {
  name: 'alpha_dash',
  validate: (v, field) =>
    isEmpty(v) || /^[a-zA-Z0-9_-]+$/.test(String(v)) || `The ${field} field must only contain letters, numbers, dashes and underscores.`,
}

export const startsWith: Rule = {
  name: 'starts_with',
  validate: (v, field, _data, params) =>
    isEmpty(v) || params.some((p) => String(v).startsWith(p)) || `The ${field} field must start with one of: ${params.join(', ')}.`,
}

export const endsWith: Rule = {
  name: 'ends_with',
  validate: (v, field, _data, params) =>
    isEmpty(v) || params.some((p) => String(v).endsWith(p)) || `The ${field} field must end with one of: ${params.join(', ')}.`,
}

export const lowercase: Rule = {
  name: 'lowercase',
  validate: (v, field) =>
    isEmpty(v) || String(v) === String(v).toLowerCase() || `The ${field} field must be lowercase.`,
}

export const uppercase: Rule = {
  name: 'uppercase',
  validate: (v, field) =>
    isEmpty(v) || String(v) === String(v).toUpperCase() || `The ${field} field must be uppercase.`,
}

// ── Comparison rules ─────────────────────────────────────────────────────────

export const confirmed: Rule = {
  name: 'confirmed',
  validate: (v, field, data) =>
    isEmpty(v) || v === data[`${field}_confirmation`] || `The ${field} confirmation does not match.`,
}

export const same: Rule = {
  name: 'same',
  validate: (v, field, data, [other]) =>
    isEmpty(v) || v === getNestedValue(data, other!) || `The ${field} and ${other} must match.`,
}

export const different: Rule = {
  name: 'different',
  validate: (v, field, data, [other]) =>
    isEmpty(v) || v !== getNestedValue(data, other!) || `The ${field} and ${other} must be different.`,
}

export const gt: Rule = {
  name: 'gt',
  validate: (v, field, data, [other]) => {
    if (isEmpty(v)) return true
    const otherVal = getNestedValue(data, other!)
    return getSize(v) > getSize(otherVal) || `The ${field} field must be greater than ${other}.`
  },
}

export const gte: Rule = {
  name: 'gte',
  validate: (v, field, data, [other]) => {
    if (isEmpty(v)) return true
    const otherVal = getNestedValue(data, other!)
    return getSize(v) >= getSize(otherVal) || `The ${field} field must be greater than or equal to ${other}.`
  },
}

export const lt: Rule = {
  name: 'lt',
  validate: (v, field, data, [other]) => {
    if (isEmpty(v)) return true
    const otherVal = getNestedValue(data, other!)
    return getSize(v) < getSize(otherVal) || `The ${field} field must be less than ${other}.`
  },
}

export const lte: Rule = {
  name: 'lte',
  validate: (v, field, data, [other]) => {
    if (isEmpty(v)) return true
    const otherVal = getNestedValue(data, other!)
    return getSize(v) <= getSize(otherVal) || `The ${field} field must be less than or equal to ${other}.`
  },
}

// ── Inclusion rules ──────────────────────────────────────────────────────────

export const inRule: Rule = {
  name: 'in',
  validate: (v, field, _data, params) =>
    isEmpty(v) || params.includes(String(v)) || `The selected ${field} is invalid.`,
}

export const notIn: Rule = {
  name: 'not_in',
  validate: (v, field, _data, params) =>
    isEmpty(v) || !params.includes(String(v)) || `The selected ${field} is invalid.`,
}

// ── Date rules ───────────────────────────────────────────────────────────────

export const date: Rule = {
  name: 'date',
  validate: (v, field) => {
    if (isEmpty(v)) return true
    const s = String(v)
    const ts = Date.parse(s)
    if (isNaN(ts)) return `The ${field} field must be a valid date.`

    // For YYYY-MM-DD format, verify that the parsed date components match the input
    // to reject impossible dates like Feb 30, Apr 31, etc.
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      const d = new Date(ts)
      const [, year, month, day] = isoMatch
      if (
        d.getUTCFullYear() !== Number(year) ||
        d.getUTCMonth() + 1 !== Number(month) ||
        d.getUTCDate() !== Number(day)
      ) {
        return `The ${field} field must be a valid date.`
      }
    }
    return true
  },
}

export const before: Rule = {
  name: 'before',
  validate: (v, field, _data, [param]) =>
    isEmpty(v) || new Date(String(v)) < new Date(param!) || `The ${field} field must be a date before ${param}.`,
}

export const after: Rule = {
  name: 'after',
  validate: (v, field, _data, [param]) =>
    isEmpty(v) || new Date(String(v)) > new Date(param!) || `The ${field} field must be a date after ${param}.`,
}

// ── Special rules ────────────────────────────────────────────────────────────

export const ip: Rule = {
  name: 'ip',
  validate: (v, field) => {
    if (isEmpty(v)) return true
    const s = String(v)
    const v4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every((p) => Number(p) <= 255)
    const v6 = isValidIPv6(s)
    return v4 || v6 || `The ${field} field must be a valid IP address.`
  },
}

export const json: Rule = {
  name: 'json',
  validate: (v, field) => {
    if (isEmpty(v)) return true
    try { JSON.parse(String(v)); return true } catch { return `The ${field} field must be a valid JSON string.` }
  },
}

// ── Database rules (require PresenceVerifier) ───────────────────────────────

export const exists: Rule = {
  name: 'exists',
  validate: async (v, field, _data, params, context) => {
    if (isEmpty(v)) return true
    const [table, column = field] = params
    if (!table) throw new Error('The exists rule requires a table parameter.')
    const verifier = context?.presenceVerifier
    if (!verifier) throw new Error('A presence verifier is required for the exists rule. Set it via validator.setPresenceVerifier().')
    const count = await verifier.getCount(table, column, v)
    return count > 0 || `The selected ${field} is invalid.`
  },
}

export const unique: Rule = {
  name: 'unique',
  validate: async (v, field, _data, params, context) => {
    if (isEmpty(v)) return true
    const [table, column = field, except, idColumn = 'id'] = params
    if (!table) throw new Error('The unique rule requires a table parameter.')
    const verifier = context?.presenceVerifier
    if (!verifier) throw new Error('A presence verifier is required for the unique rule. Set it via validator.setPresenceVerifier().')
    const excludeId = !except || except === 'NULL' ? null : except
    const count = await verifier.getCount(table, column, v, excludeId, idColumn)
    return count === 0 || `The ${field} has already been taken.`
  },
}

// ── Map rule names to implementations ────────────────────────────────────────

export const builtinRules: Record<string, Rule> = {
  required, nullable, present, filled,
  required_if: requiredIf, required_unless: requiredUnless,
  required_with: requiredWith, required_without: requiredWithout,
  string, numeric, integer, boolean, array, object,
  min, max, between, size,
  email, url, uuid, regex, alpha, alpha_num: alphaNum, alpha_dash: alphaDash,
  starts_with: startsWith, ends_with: endsWith, lowercase, uppercase,
  confirmed, same, different, gt, gte, lt, lte,
  in: inRule, not_in: notIn,
  date, before, after,
  ip, json,
  exists, unique,
}
