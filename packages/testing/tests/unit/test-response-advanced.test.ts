import { describe, it, expect } from 'bun:test'
import { TestResponse } from '../../src/TestResponse.ts'

function jsonResponse(body: any, status = 200) {
  return new TestResponse(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

describe('TestResponse — JSON Path Assertions', () => {
  const data = {
    data: {
      users: [
        { id: 1, name: 'Ali', email: 'ali@test.com' },
        { id: 2, name: 'Sara', email: 'sara@test.com' },
      ],
      meta: { total: 2, page: 1 },
    },
  }

  it('assertJsonPath resolves dot-notation paths', async () => {
    const res = jsonResponse(data)
    await res.assertJsonPath('data.meta.total', 2)
    await res.assertJsonPath('data.users.0.name', 'Ali')
    await res.assertJsonPath('data.users.1.email', 'sara@test.com')
  })

  it('assertJsonCount counts items at path', async () => {
    const res = jsonResponse(data)
    await res.assertJsonCount(2, 'data.users')
  })

  it('assertJsonCount counts root keys', async () => {
    const res = jsonResponse({ a: 1, b: 2, c: 3 })
    await res.assertJsonCount(3)
  })

  it('assertJsonStructure validates shape with array of keys', async () => {
    const res = jsonResponse(data)
    await res.assertJsonStructure(['data'])
    await res.assertJsonStructure(['total', 'page'], 'data.meta')
  })

  it('assertJsonStructure validates nested shape', async () => {
    const res = jsonResponse(data)
    await res.assertJsonStructure({
      data: { users: ['id', 'name', 'email'] },
    })
  })

  it('assertJsonMissing checks subset is absent', async () => {
    const res = jsonResponse({ name: 'Ali', role: 'admin' })
    await res.assertJsonMissing({ password: 'secret' })
  })
})

describe('TestResponse — Text Assertions', () => {
  it('assertSeeInOrder checks ordered text', async () => {
    const res = new TestResponse(new Response('Hello World Goodbye'))
    await res.assertSeeInOrder(['Hello', 'World', 'Goodbye'])
  })
})

describe('TestResponse — Status Assertions', () => {
  it('assertServerError checks 5xx', () => {
    jsonResponse({}, 500).assertServerError()
    jsonResponse({}, 503).assertServerError()
  })

  it('assertClientError checks 4xx', () => {
    jsonResponse({}, 400).assertClientError()
    jsonResponse({}, 422).assertClientError()
    jsonResponse({}, 404).assertClientError()
  })

  it('assertValid checks not 422', () => {
    jsonResponse({}, 200).assertValid()
    jsonResponse({}, 201).assertValid()
  })

  it('assertInvalid checks 422 with optional field errors', async () => {
    const res = jsonResponse({ errors: { email: ['required'], name: ['required'] } }, 422)
    await res.assertInvalid()
    await res.assertInvalid(['email', 'name'])
  })
})

describe('TestResponse — Download', () => {
  it('assertDownload checks content-disposition', () => {
    const res = new TestResponse(new Response('file data', {
      headers: { 'Content-Disposition': 'attachment; filename="report.csv"' },
    }))
    res.assertDownload()
    res.assertDownload('report.csv')
  })
})

describe('TestResponse — Debug', () => {
  it('dump returns this for chaining', async () => {
    const res = jsonResponse({ test: true })
    const result = await res.dump()
    expect(result).toBe(res)
  })
})
