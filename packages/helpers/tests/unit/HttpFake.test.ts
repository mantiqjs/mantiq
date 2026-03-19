import { describe, expect, test, afterEach } from 'bun:test'
import { Http } from '../../src/Http.ts'
import { HttpFake } from '../../src/HttpFake.ts'

describe('HttpFake', () => {
  const fake = new HttpFake()

  afterEach(() => {
    fake.clear()
    fake.restore()
  })

  describe('stub + middleware mode', () => {
    test('stubs a GET request', async () => {
      fake.get('/api/users', { status: 200, body: [{ id: 1, name: 'Alice' }] })

      const response = await Http.withMiddleware(fake.middleware()).get('http://test/api/users')
      expect(response.status).toBe(200)
      expect(response.data).toEqual([{ id: 1, name: 'Alice' }])
    })

    test('stubs a POST request', async () => {
      fake.post('/api/users', { status: 201, body: { id: 2 } })

      const response = await Http.withMiddleware(fake.middleware())
        .post('http://test/api/users', { name: 'Bob' })
      expect(response.status).toBe(201)
      expect(response.data).toEqual({ id: 2 })
    })

    test('stubs with regex pattern', async () => {
      fake.get(/\/api\/users\/\d+/, { status: 200, body: { id: 42, name: 'User' } })

      const response = await Http.withMiddleware(fake.middleware()).get('http://test/api/users/42')
      expect(response.data.id).toBe(42)
    })

    test('stubs with handler function', async () => {
      fake.get('/api/echo', (req) => {
        const url = new URL(req.url)
        return { status: 200, body: { path: url.pathname } }
      })

      const response = await Http.withMiddleware(fake.middleware()).get('http://test/api/echo')
      expect(response.data.path).toBe('/api/echo')
    })

    test('stubOnce is consumed after first match', async () => {
      fake.stubOnce('GET', '/api/data', { status: 200, body: { v: 1 } })
      fake.stub('GET', '/api/data', { status: 200, body: { v: 2 } })

      const m = fake.middleware()
      const r1 = await Http.withMiddleware(m).get('http://test/api/data')
      expect(r1.data.v).toBe(1)

      const r2 = await Http.withMiddleware(m).get('http://test/api/data')
      expect(r2.data.v).toBe(2)
    })
  })

  describe('install (global fetch replacement)', () => {
    test('replaces and restores global fetch', async () => {
      fake.get('/api/items', { status: 200, body: ['a', 'b'] })
      fake.install()

      const response = await Http.get('http://test/api/items')
      expect(response.data).toEqual(['a', 'b'])

      fake.restore()
    })
  })

  describe('sequence', () => {
    test('returns responses in order', async () => {
      fake.sequence('GET', '/api/status', [
        { status: 503 },
        { status: 503 },
        { status: 200, body: { ok: true } },
      ])

      const m = fake.middleware()

      // First two should throw (503)
      try {
        await Http.withMiddleware(m).get('http://test/api/status')
      } catch (e: any) {
        expect(e.status).toBe(503)
      }

      try {
        await Http.withMiddleware(m).get('http://test/api/status')
      } catch (e: any) {
        expect(e.status).toBe(503)
      }

      // Third should succeed
      const response = await Http.withMiddleware(m).get('http://test/api/status')
      expect(response.data).toEqual({ ok: true })
    })
  })

  describe('preventStrayRequests', () => {
    test('throws on unmatched requests', async () => {
      fake.preventStrayRequests()
      const m = fake.middleware()

      try {
        await Http.withMiddleware(m).get('http://test/api/unknown')
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toContain('Unexpected request')
      }
    })
  })

  describe('assertions', () => {
    test('assertSent passes when request was made', async () => {
      fake.get('/api/users', { status: 200, body: [] })
      await Http.withMiddleware(fake.middleware()).get('http://test/api/users')

      expect(() => fake.assertSent('GET', '/api/users')).not.toThrow()
    })

    test('assertSent fails when request was not made', () => {
      expect(() => fake.assertSent('GET', '/api/users')).toThrow('was not sent')
    })

    test('assertNotSent passes when request was not made', () => {
      expect(() => fake.assertNotSent('POST', '/api/users')).not.toThrow()
    })

    test('assertNotSent fails when request was made', async () => {
      fake.get('/api/users', { status: 200, body: [] })
      await Http.withMiddleware(fake.middleware()).get('http://test/api/users')

      expect(() => fake.assertNotSent('GET', '/api/users')).toThrow('was sent')
    })

    test('assertSentCount', async () => {
      fake.get('/api/users', { status: 200, body: [] })
      const m = fake.middleware()
      await Http.withMiddleware(m).get('http://test/api/users')
      await Http.withMiddleware(m).get('http://test/api/users')

      fake.assertSentCount(2)
      expect(() => fake.assertSentCount(3)).toThrow()
    })

    test('assertNothingSent', () => {
      fake.assertNothingSent()
    })

    test('assertSentWith checks request details', async () => {
      fake.post('/api/users', { status: 201, body: { id: 1 } })
      await Http.withMiddleware(fake.middleware())
        .post('http://test/api/users', { name: 'Alice' })

      fake.assertSentWith('POST', '/api/users', (req) => {
        return req.body?.name === 'Alice'
      })

      expect(() => {
        fake.assertSentWith('POST', '/api/users', (req) => req.body?.name === 'Bob')
      }).toThrow()
    })
  })

  describe('inspection', () => {
    test('requests() returns all recorded', async () => {
      fake.get('/a', { body: 1 })
      fake.get('/b', { body: 2 })
      const m = fake.middleware()
      await Http.withMiddleware(m).get('http://test/a')
      await Http.withMiddleware(m).get('http://test/b')

      expect(fake.requests().length).toBe(2)
    })

    test('sent() filters by method and pattern', async () => {
      fake.get('/a', { body: 1 })
      fake.post('/b', { body: 2 })
      const m = fake.middleware()
      await Http.withMiddleware(m).get('http://test/a')
      await Http.withMiddleware(m).post('http://test/b', {})

      expect(fake.sent('GET').length).toBe(1)
      expect(fake.sent('POST', '/b').length).toBe(1)
      expect(fake.sent('PUT').length).toBe(0)
    })

    test('reset clears recorded but keeps stubs', async () => {
      fake.get('/a', { body: { v: 1 } })
      const m = fake.middleware()
      await Http.withMiddleware(m).get('http://test/a')
      expect(fake.requests().length).toBe(1)

      fake.reset()
      expect(fake.requests().length).toBe(0)

      // Stubs still work
      const r = await Http.withMiddleware(m).get('http://test/a')
      expect(r.data).toEqual({ v: 1 })
    })
  })
})
