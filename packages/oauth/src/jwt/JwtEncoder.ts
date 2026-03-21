/**
 * Base64URL encode/decode utilities for JWT.
 * No external dependencies — uses standard APIs only.
 */

/**
 * Encode a Uint8Array to a Base64URL string (no padding).
 */
export function base64UrlEncode(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Decode a Base64URL string to a Uint8Array.
 */
export function base64UrlDecode(str: string): Uint8Array {
  // Restore standard Base64 characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  // Restore padding
  const pad = base64.length % 4
  if (pad === 2) base64 += '=='
  else if (pad === 3) base64 += '='

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Encode a UTF-8 string to Base64URL.
 */
export function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str))
}

/**
 * Decode a Base64URL string to a UTF-8 string.
 */
export function base64UrlDecodeString(str: string): string {
  return new TextDecoder().decode(base64UrlDecode(str))
}
