/**
 * Generate a fingerprint for an Error to group similar exceptions.
 * Uses the error class name + the first meaningful line of the stack trace.
 */
export function errorFingerprint(error: Error): string {
  const className = error.constructor?.name ?? 'Error'
  const raw = `${className}:${error.message}`
  return simpleHash(raw)
}

/**
 * Normalize a SQL query by replacing literal values with placeholders.
 * Used to group similar queries (e.g., same query structure, different IDs).
 *
 * @example
 * normalizeQuery("SELECT * FROM users WHERE id = 42")
 * // → "SELECT * FROM users WHERE id = ?"
 */
export function normalizeQuery(sql: string): string {
  return sql
    // Replace quoted strings
    .replace(/'[^']*'/g, '?')
    .replace(/"[^"]*"/g, '?')
    // Replace numbers (standalone)
    .replace(/\b\d+(\.\d+)?\b/g, '?')
    // Collapse IN lists
    .replace(/\(\s*\?\s*(,\s*\?\s*)*\)/g, '(?)')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract the first non-native stack frame (application code).
 */
function extractFirstAppFrame(stack: string): string {
  const lines = stack.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (
      trimmed.startsWith('at ') &&
      !trimmed.includes('node:') &&
      !trimmed.includes('bun:') &&
      !trimmed.includes('node_modules')
    ) {
      return trimmed
    }
  }
  return lines[1]?.trim() ?? ''
}

/**
 * Simple FNV-1a hash that produces a hex string.
 * Not cryptographic — just for grouping.
 */
function simpleHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
