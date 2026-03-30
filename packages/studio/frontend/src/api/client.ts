/**
 * Studio API client.
 *
 * Prepends the panel base path to all URLs, attaches the CSRF token from
 * cookies, and handles standard HTTP error codes (401, 403, 422).
 */

export interface ValidationErrors {
  [field: string]: string[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ValidationError extends ApiError {
  constructor(public errors: ValidationErrors) {
    super('Validation failed', 422, errors)
    this.name = 'ValidationError'
  }
}

function getBasePath(): string {
  // The base path is embedded in the HTML root element by the server,
  // or inferred from the current URL path prefix before /resources, /api, etc.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="studio-base-path"]')
  if (meta?.content) return meta.content

  // Fallback: extract from window.__STUDIO_BASE_PATH__ if set by the server
  if (typeof (window as any).__STUDIO_BASE_PATH__ === 'string') {
    return (window as any).__STUDIO_BASE_PATH__
  }

  // Last resort: use empty string (root-relative URLs)
  return ''
}

function getCsrfToken(): string | null {
  // Read XSRF-TOKEN from cookies (set by EncryptCookies / VerifyCsrfToken middleware)
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]!) : null
}

async function request<T = any>(
  method: string,
  url: string,
  options: { params?: Record<string, string>; data?: unknown } = {},
): Promise<T> {
  const basePath = getBasePath()
  let fullUrl = `${basePath}/api${url}`

  // Append query params for GET requests
  if (options.params && Object.keys(options.params).length > 0) {
    const search = new URLSearchParams(options.params)
    fullUrl += `?${search.toString()}`
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  const csrf = getCsrfToken()
  if (csrf) {
    headers['X-XSRF-TOKEN'] = csrf
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: 'same-origin',
  }

  if (options.data !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.data)
  }

  const response = await fetch(fullUrl, init)

  // Handle specific status codes
  if (response.status === 401) {
    // Redirect to login
    window.location.href = `${basePath}/login`
    throw new ApiError('Unauthenticated', 401)
  }

  if (response.status === 403) {
    throw new ApiError('Unauthorized', 403)
  }

  if (response.status === 422) {
    const body = await response.json()
    throw new ValidationError(body.errors ?? {})
  }

  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      // Not JSON
    }
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as any).error)
        : `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, body)
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const api = {
  get<T = any>(url: string, params?: Record<string, string>): Promise<T> {
    return request<T>('GET', url, { params })
  },

  post<T = any>(url: string, data?: unknown): Promise<T> {
    return request<T>('POST', url, { data })
  },

  put<T = any>(url: string, data?: unknown): Promise<T> {
    return request<T>('PUT', url, { data })
  },

  delete<T = any>(url: string): Promise<T> {
    return request<T>('DELETE', url)
  },
}
