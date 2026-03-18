import { describe, it, expect } from 'bun:test'
import { MantiqRequest } from '../../src/http/Request.ts'

function req(method: string, url: string, body?: BodyInit, headers?: Record<string, string>): MantiqRequest {
  return MantiqRequest.fromBun(new Request(`http://localhost${url}`, { method, body, headers }))
}

describe('MantiqRequest', () => {
  it('method: returns uppercase HTTP method', () => {
    expect(req('get', '/').method()).toBe('GET')
    expect(req('post', '/').method()).toBe('POST')
  })

  it('path: returns pathname without query string', () => {
    expect(req('GET', '/users?page=2').path()).toBe('/users')
  })

  it('url: returns pathname + query string', () => {
    expect(req('GET', '/users?page=2').url()).toBe('/users?page=2')
  })

  it('fullUrl: returns complete URL', () => {
    expect(req('GET', '/users').fullUrl()).toBe('http://localhost/users')
  })

  it('query(): returns all query params as object', () => {
    const r = req('GET', '/search?q=hello&page=2')
    const q = r.query()
    expect(q['q']).toBe('hello')
    expect(q['page']).toBe('2')
  })

  it('query(key): returns specific query param', () => {
    expect(req('GET', '/?name=alice').query('name')).toBe('alice')
  })

  it('query(key, default): returns default for missing key', () => {
    expect(req('GET', '/').query('missing', 'default')).toBe('default')
  })

  it('input(): parses JSON body', async () => {
    const r = req('POST', '/', JSON.stringify({ name: 'Alice' }), { 'Content-Type': 'application/json' })
    const body = await r.input()
    expect(body['name']).toBe('Alice')
  })

  it('input(key): returns specific body field', async () => {
    const r = req('POST', '/', JSON.stringify({ age: 30 }), { 'Content-Type': 'application/json' })
    expect(await r.input('age')).toBe(30)
  })

  it('input(key, default): returns default for missing field', async () => {
    const r = req('POST', '/', JSON.stringify({}), { 'Content-Type': 'application/json' })
    expect(await r.input('missing', 'fallback')).toBe('fallback')
  })

  it('only(): returns only specified keys', async () => {
    const r = req('POST', '/', JSON.stringify({ a: 1, b: 2, c: 3 }), { 'Content-Type': 'application/json' })
    const result = await r.only('a', 'c')
    expect(result).toEqual({ a: 1, c: 3 })
  })

  it('except(): returns all except specified keys', async () => {
    const r = req('POST', '/', JSON.stringify({ a: 1, b: 2, c: 3 }), { 'Content-Type': 'application/json' })
    const result = await r.except('b')
    expect(result).toHaveProperty('a')
    expect(result).toHaveProperty('c')
    expect(result).not.toHaveProperty('b')
  })

  it('header(): returns header value case-insensitively', () => {
    const r = req('GET', '/', undefined, { 'X-Custom': 'value' })
    expect(r.header('x-custom')).toBe('value')
  })

  it('header(): returns default for missing header', () => {
    expect(req('GET', '/').header('x-missing', 'default')).toBe('default')
  })

  it('expectsJson(): true when Accept is application/json', () => {
    const r = req('GET', '/', undefined, { Accept: 'application/json' })
    expect(r.expectsJson()).toBe(true)
  })

  it('expectsJson(): false for HTML accept', () => {
    const r = req('GET', '/', undefined, { Accept: 'text/html' })
    expect(r.expectsJson()).toBe(false)
  })

  it('isJson(): true when Content-Type is application/json', () => {
    const r = req('POST', '/', '{}', { 'Content-Type': 'application/json' })
    expect(r.isJson()).toBe(true)
  })

  it('setRouteParams / param: stores and retrieves route params', () => {
    const r = req('GET', '/users/42')
    r.setRouteParams({ id: '42' })
    expect(r.param('id')).toBe('42')
    expect(r.param('missing', 'default')).toBe('default')
  })

  it('setUser / user: stores and retrieves authenticated user', () => {
    const r = req('GET', '/')
    expect(r.isAuthenticated()).toBe(false)
    r.setUser({ id: 1 })
    expect(r.isAuthenticated()).toBe(true)
    expect(r.user()).toEqual({ id: 1 })
  })

  it('raw(): returns the original Bun Request', () => {
    const bunReq = new Request('http://localhost/')
    const r = MantiqRequest.fromBun(bunReq)
    expect(r.raw()).toBe(bunReq)
  })
})
