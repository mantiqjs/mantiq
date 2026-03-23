import { describe, it, expect } from 'bun:test'
import { TestClient } from '../../src/TestClient.ts'

describe('TestClient', () => {
  // Simple handler that echoes back request info
  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const body = req.method !== 'GET' ? await req.text() : null
    const headers = Object.fromEntries(req.headers.entries())

    return new Response(JSON.stringify({
      method: req.method,
      path: url.pathname,
      body: body ? JSON.parse(body) : null,
      headers,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'mantiq_session=abc123; Path=/; HttpOnly',
      },
    })
  }

  it('sends GET requests', async () => {
    const client = new TestClient(handler)
    const res = await client.get('/test')
    const data = await res.json()
    expect(data.method).toBe('GET')
    expect(data.path).toBe('/test')
  })

  it('sends POST with JSON body', async () => {
    const client = new TestClient(handler)
    const res = await client.post('/users', { name: 'Ali' })
    const data = await res.json()
    expect(data.method).toBe('POST')
    expect(data.body.name).toBe('Ali')
    expect(data.headers['content-type']).toBe('application/json')
  })

  it('persists cookies across requests', async () => {
    const client = new TestClient(handler)
    await client.get('/page1')
    const res = await client.get('/page2')
    const data = await res.json()
    expect(data.headers.cookie).toContain('mantiq_session=abc123')
  })

  it('sends XSRF token on mutating requests', async () => {
    // Handler that sets XSRF cookie
    const xsrfHandler = async (req: Request): Promise<Response> => {
      const headers = Object.fromEntries(req.headers.entries())
      return new Response(JSON.stringify({ headers }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'XSRF-TOKEN=test-csrf-token; Path=/',
        },
      })
    }

    const client = new TestClient(xsrfHandler)
    await client.get('/') // Get XSRF cookie
    const res = await client.post('/submit', { data: 1 })
    const data = await res.json()
    expect(data.headers['x-xsrf-token']).toBe('test-csrf-token')
  })

  it('withToken sets bearer auth', async () => {
    const client = new TestClient(handler)
    client.withToken('my-api-token')
    const res = await client.get('/api/user')
    const data = await res.json()
    expect(data.headers.authorization).toBe('Bearer my-api-token')
  })

  it('withHeaders sets custom headers', async () => {
    const client = new TestClient(handler)
    client.withHeaders({ 'X-Custom': 'value' })
    const res = await client.get('/test')
    const data = await res.json()
    expect(data.headers['x-custom']).toBe('value')
  })

  it('flushCookies clears session', async () => {
    const client = new TestClient(handler)
    await client.get('/page1') // Sets cookie
    client.flushCookies()
    const res = await client.get('/page2')
    const data = await res.json()
    expect(data.headers.cookie).toBeUndefined()
  })

  it('supports PUT, PATCH, DELETE', async () => {
    const client = new TestClient(handler)
    const put = await client.put('/users/1', { name: 'Updated' })
    expect((await put.json()).method).toBe('PUT')

    const patch = await client.patch('/users/1', { name: 'Patched' })
    expect((await patch.json()).method).toBe('PATCH')

    const del = await client.delete('/users/1')
    expect((await del.json()).method).toBe('DELETE')
  })
})
