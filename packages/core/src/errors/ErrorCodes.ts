/**
 * Structured error codes for all MantiqJS framework errors.
 *
 * Each error code follows the pattern `E_{CATEGORY}_{DESCRIPTION}`.
 * These codes are stable identifiers that can be used for:
 * - Machine-readable error handling in API responses
 * - Mapping errors to translations
 * - Monitoring and alerting
 * - Client-side error matching
 *
 * @example
 *   if (error.errorCode === ErrorCodes.AUTH_UNAUTHENTICATED) {
 *     redirectToLogin()
 *   }
 */
export const ErrorCodes = {
  // ── Authentication ──────────────────────────────────────────────────────
  AUTH_UNAUTHENTICATED: 'E_AUTH_UNAUTHENTICATED',
  AUTH_UNAUTHORIZED: 'E_AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'E_AUTH_FORBIDDEN',

  // ── Validation ──────────────────────────────────────────────────────────
  VALIDATION_FAILED: 'E_VALIDATION_FAILED',

  // ── Model / ORM ─────────────────────────────────────────────────────────
  MODEL_NOT_FOUND: 'E_MODEL_NOT_FOUND',

  // ── Routing ─────────────────────────────────────────────────────────────
  ROUTE_NOT_FOUND: 'E_ROUTE_NOT_FOUND',

  // ── CSRF ────────────────────────────────────────────────────────────────
  CSRF_MISMATCH: 'E_CSRF_MISMATCH',

  // ── Encryption ──────────────────────────────────────────────────────────
  ENCRYPTION_FAILED: 'E_ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'E_DECRYPTION_FAILED',
  MISSING_APP_KEY: 'E_MISSING_APP_KEY',

  // ── Rate Limiting ───────────────────────────────────────────────────────
  RATE_LIMITED: 'E_RATE_LIMITED',

  // ── Container ───────────────────────────────────────────────────────────
  CONTAINER_RESOLUTION: 'E_CONTAINER_RESOLUTION',

  // ── Configuration ───────────────────────────────────────────────────────
  CONFIG_NOT_FOUND: 'E_CONFIG_NOT_FOUND',

  // ── Database ────────────────────────────────────────────────────────────
  QUERY_ERROR: 'E_QUERY_ERROR',
  CONNECTION_LOST: 'E_CONNECTION_LOST',
  CONNECTION_FAILED: 'E_CONNECTION_FAILED',
  DRIVER_NOT_SUPPORTED: 'E_DRIVER_NOT_SUPPORTED',

  // ── HTTP ────────────────────────────────────────────────────────────────
  HTTP_ERROR: 'E_HTTP_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
