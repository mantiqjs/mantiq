export async function api<T = any>(url: string, opts: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } })

  // Session expired — redirect to login
  if (res.status === 401 || res.status === 419) {
    window.location.href = '/login'
    return { ok: false, status: res.status, data: null as any }
  }

  const ct = res.headers.get('content-type') ?? ''
  const data = ct.includes('json') ? await res.json() : null
  return { ok: res.ok, status: res.status, data }
}

export function post(url: string, body: object) {
  return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
