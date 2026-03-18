/**
 * Read an environment variable with type coercion.
 *
 * Type coercion rules:
 * - 'true' / 'false' → boolean
 * - '' (empty string) → '' (not undefined)
 * - undefined → defaultValue
 * - All other strings remain strings
 *
 * @example env('APP_DEBUG', false)
 * @example env('APP_NAME', 'MantiqJS')
 */
export function env<T = string>(key: string, defaultValue?: T): T {
  const raw = process.env[key]

  if (raw === undefined) {
    if (defaultValue !== undefined) return defaultValue
    return undefined as unknown as T
  }

  // Boolean coercion
  if (raw === 'true') return true as unknown as T
  if (raw === 'false') return false as unknown as T

  return raw as unknown as T
}
