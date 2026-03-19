/**
 * W3C Trace Context (traceparent) propagation utilities.
 *
 * Format: `{version}-{trace-id}-{parent-id}-{trace-flags}`
 * Example: `00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01`
 */

export interface ParsedTraceContext {
  version: string
  traceId: string
  parentId: string
  traceFlags: string
  sampled: boolean
}

/**
 * Parse a W3C traceparent header.
 */
export function parseTraceparent(header: string): ParsedTraceContext | null {
  const parts = header.trim().split('-')
  if (parts.length !== 4) return null

  const [version, traceId, parentId, traceFlags] = parts
  if (!version || !traceId || !parentId || !traceFlags) return null
  if (traceId.length !== 32 || parentId.length !== 16) return null

  return {
    version,
    traceId,
    parentId,
    traceFlags,
    sampled: (parseInt(traceFlags, 16) & 0x01) === 1,
  }
}

/**
 * Create a W3C traceparent header string.
 */
export function createTraceparent(traceId: string, spanId: string, sampled = true): string {
  const flags = sampled ? '01' : '00'
  return `00-${traceId}-${spanId}-${flags}`
}

/**
 * Generate a random 32-character hex trace ID.
 */
export function generateTraceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a random 16-character hex span ID.
 */
export function generateSpanId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
