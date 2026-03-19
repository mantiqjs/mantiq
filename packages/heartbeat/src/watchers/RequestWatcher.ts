import { Watcher } from '../contracts/Watcher.ts'
import type { RequestEntryContent } from '../contracts/Entry.ts'

/**
 * Keys whose values are always redacted before storage.
 * Matched case-insensitively against object keys at any depth.
 */
const SENSITIVE_KEYS = [
  'password', 'password_confirmation',
  'secret', 'client_secret',
  'token', 'access_token', 'refresh_token', 'api_token',
  'api_key', 'apikey', 'api-key',
  'authorization',
  'cookie', 'set-cookie',
  'x-csrf-token', 'csrf',
  'ssn', 'social_security',
  'credit_card', 'card_number', 'cvv', 'cvc',
  'private_key', 'privatekey',
]

const SENSITIVE_SET = new Set(SENSITIVE_KEYS.map((k) => k.toLowerCase()))

/**
 * Records HTTP request lifecycle data.
 *
 * Captures full request/response details including headers, body,
 * query params, cookies, and response payload for detailed inspection.
 * All data is sanitized before storage — sensitive fields are redacted.
 */
export class RequestWatcher extends Watcher {
  override register(): void {
    // RequestWatcher is driven by HeartbeatMiddleware, not by events.
    // The middleware calls recordRequest() directly.
  }

  recordRequest(data: {
    method: string
    path: string
    url: string
    status: number
    duration: number
    ip: string | null
    middleware: string[]
    controller: string | null
    routeName: string | null
    memoryUsage: number
    // Request
    requestHeaders: Record<string, string>
    requestQuery: Record<string, string>
    requestBody: Record<string, any> | null
    requestCookies: Record<string, string>
    // Response
    responseHeaders: Record<string, string>
    responseSize: number | null
    responseBody: string | null
    // Auth
    userId: string | number | null
  }): void {
    if (!this.isEnabled()) return

    const ignore = (this.options.ignore as string[]) ?? []
    if (ignore.some((pattern) => data.path.startsWith(pattern))) return

    const slowThreshold = (this.options.slow_threshold as number) ?? 1000
    const tags: string[] = []
    if (data.duration > slowThreshold) tags.push('slow')
    if (data.status >= 500) tags.push('error')
    if (data.status >= 400) tags.push('client-error')

    const content: RequestEntryContent = {
      method: data.method,
      path: data.path,
      url: data.url,
      status: data.status,
      duration: data.duration,
      ip: data.ip,
      middleware: data.middleware,
      controller: data.controller,
      route_name: data.routeName,
      memory_usage: data.memoryUsage,
      request_headers: sanitize(data.requestHeaders),
      request_query: sanitize(data.requestQuery),
      request_body: data.requestBody ? sanitize(data.requestBody) : null,
      request_cookies: data.requestCookies,
      response_headers: sanitize(data.responseHeaders),
      response_size: data.responseSize,
      response_body: data.responseBody ? sanitizeJsonString(data.responseBody) : null,
      user_id: data.userId,
    }

    this.record('request', content, tags)
  }
}

/**
 * Recursively redact values of sensitive keys in an object.
 * Returns a new object — never mutates the input.
 */
function sanitize<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null ? sanitize(item) : item,
    ) as unknown as T
  }

  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_SET.has(key.toLowerCase())) {
      result[key] = '********'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitize(value)
    } else {
      result[key] = value
    }
  }
  return result as T
}

/**
 * Parse a JSON response body string, sanitize it, and re-serialize.
 */
function sanitizeJsonString(body: string): string {
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      return JSON.stringify(sanitize(parsed))
    }
    return body
  } catch {
    return body
  }
}
