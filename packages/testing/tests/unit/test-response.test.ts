import { describe, it, expect } from 'bun:test'
import { TestResponse } from '../../src/TestResponse.ts'

describe('TestResponse', () => {
  function makeResponse(body: any, status = 200, headers: Record<string, string> = {}) {
    const h = new Headers({ 'content-type': 'application/json', ...headers })
    return new TestResponse(new Response(JSON.stringify(body), { status, headers: h }))
  }

  it('assertStatus checks status code', () => {
    makeResponse({}, 201).assertStatus(201)
    makeResponse({}, 404).assertNotFound()
    makeResponse({}, 200).assertOk()
    makeResponse({}, 422).assertUnprocessable()
  })

  it('assertSuccessful checks 2xx range', () => {
    makeResponse({}, 200).assertSuccessful()
    makeResponse({}, 201).assertSuccessful()
    makeResponse({}, 204).assertSuccessful()
  })

  it('assertJson checks subset of body', async () => {
    const res = makeResponse({ name: 'Ali', email: 'ali@test.com', extra: true })
    await res.assertJson({ name: 'Ali', email: 'ali@test.com' })
  })

  it('assertJsonHasKey checks keys exist', async () => {
    const res = makeResponse({ id: 1, name: 'Ali' })
    await res.assertJsonHasKey('id', 'name')
  })

  it('assertJsonMissingKey checks keys absent', async () => {
    const res = makeResponse({ id: 1 })
    await res.assertJsonMissingKey('password', 'secret')
  })

  it('assertHeader checks header presence and value', () => {
    const res = makeResponse({}, 200, { 'X-Custom': 'hello' })
    res.assertHeader('x-custom', 'hello')
  })

  it('assertHeaderMissing checks header absence', () => {
    const res = makeResponse({})
    res.assertHeaderMissing('x-nonexistent')
  })

  it('assertSee checks body contains text', async () => {
    const res = new TestResponse(new Response('Hello World'))
    await res.assertSee('World')
  })

  it('assertDontSee checks body excludes text', async () => {
    const res = new TestResponse(new Response('Hello World'))
    await res.assertDontSee('Goodbye')
  })

  it('json() parses body', async () => {
    const res = makeResponse({ users: [1, 2, 3] })
    const data = await res.json()
    expect(data.users).toEqual([1, 2, 3])
  })
})
