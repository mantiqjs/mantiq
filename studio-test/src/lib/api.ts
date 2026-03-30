function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]!) : null
}

type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; data: null }

export async function api<T = any>(url: string, opts: RequestInit = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers as Record<string, string>) }

  // Attach XSRF token for CSRF protection on mutating requests
  if (opts.method && !['GET', 'HEAD', 'OPTIONS'].includes(opts.method)) {
    const xsrf = getCookie('XSRF-TOKEN')
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf
  }

  const res = await fetch(url, { ...opts, credentials: 'same-origin', headers })

  // Session expired — redirect to login
  if (res.status === 401 || res.status === 419) {
    window.location.href = '/login'
    return { ok: false, status: res.status, data: null }
  }

  const ct = res.headers.get('content-type') ?? ''
  const data = ct.includes('json') ? await res.json() : null
  if (!res.ok) return { ok: false, status: res.status, data: null }
  return { ok: true, status: res.status, data }
}

export function post<T = any>(url: string, body: object) {
  return api<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

export function put<T = any>(url: string, body: object) {
  return api<T>(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

export function del<T = any>(url: string) {
  return api<T>(url, { method: 'DELETE' })
}
