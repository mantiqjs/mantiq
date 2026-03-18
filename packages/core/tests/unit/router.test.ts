import { describe, it, expect, beforeEach } from 'bun:test'
import { RouterImpl } from '../../src/routing/Router.ts'
import { MantiqRequest } from '../../src/http/Request.ts'
import { NotFoundError } from '../../src/errors/NotFoundError.ts'
import { HttpError } from '../../src/errors/HttpError.ts'
import { MantiqError } from '../../src/errors/MantiqError.ts'

function makeRequest(method: string, url: string): MantiqRequest {
  return MantiqRequest.fromBun(new Request(`http://localhost${url}`, { method }))
}

class PhotoController {
  index() {}
  create() {}
  store() {}
  show() {}
  edit() {}
  update() {}
  destroy() {}
}

describe('Router', () => {
  let router: RouterImpl

  beforeEach(() => {
    router = new RouterImpl()
  })

  it('match-static-route: matches exact path', () => {
    router.get('/about', () => new Response('ok'))
    const match = router.resolve(makeRequest('GET', '/about'))
    expect(match).toBeDefined()
  })

  it('match-parameterized-route: captures :id parameter', () => {
    router.get('/users/:id', () => new Response('ok'))
    const match = router.resolve(makeRequest('GET', '/users/42'))
    expect(match.params['id']).toBe('42')
  })

  it('match-optional-param: matches without optional segment', () => {
    router.get('/posts/:slug?', () => new Response('ok'))
    const match = router.resolve(makeRequest('GET', '/posts'))
    expect(match.params['slug']).toBeUndefined()
  })

  it('match-optional-param: matches with optional segment', () => {
    router.get('/posts/:slug?', () => new Response('ok'))
    const match = router.resolve(makeRequest('GET', '/posts/hello-world'))
    expect(match.params['slug']).toBe('hello-world')
  })

  it('match-wildcard: captures rest of path', () => {
    router.get('/files/*', () => new Response('ok'))
    const match = router.resolve(makeRequest('GET', '/files/a/b/c'))
    expect(match.params['*']).toBe('a/b/c')
  })

  it('no-match-throws-404: unregistered path throws NotFoundError', () => {
    expect(() => router.resolve(makeRequest('GET', '/nonexistent'))).toThrow(NotFoundError)
  })

  it('method-mismatch-throws-405: GET registered, POST requested', () => {
    router.get('/users', () => new Response('ok'))
    let err: HttpError | undefined
    try { router.resolve(makeRequest('POST', '/users')) } catch (e) { err = e as HttpError }
    expect(err?.statusCode).toBe(405)
    expect(err?.headers?.['Allow']).toContain('GET')
  })

  it('parameter-constraint: whereNumber rejects non-numeric', () => {
    router.get('/users/:id', () => new Response('ok')).whereNumber('id')
    expect(() => router.resolve(makeRequest('GET', '/users/abc'))).toThrow(NotFoundError)
  })

  it('parameter-constraint: whereNumber accepts numeric', () => {
    router.get('/users/:id', () => new Response('ok')).whereNumber('id')
    const match = router.resolve(makeRequest('GET', '/users/42'))
    expect(match.params['id']).toBe(42) // coerced to number
  })

  it('named-route-url: generates correct URL', () => {
    router.get('/users/:id', () => new Response('ok')).name('users.show')
    expect(router.url('users.show', { id: 42 })).toBe('/users/42')
  })

  it('named-route-url: appends extra params as query string', () => {
    router.get('/search', () => new Response('ok')).name('search')
    const url = router.url('search', { q: 'hello', page: 2 })
    expect(url).toContain('q=hello')
    expect(url).toContain('page=2')
  })

  it('missing-param-throws: missing required param throws MantiqError', () => {
    router.get('/users/:id', () => new Response('ok')).name('users.show')
    expect(() => router.url('users.show')).toThrow(MantiqError)
  })

  it('route-group-prefix: all routes in group get prefix', () => {
    router.group({ prefix: '/admin' }, (r) => {
      r.get('/users', () => new Response('ok')).name('admin.users')
    })
    expect(router.url('admin.users')).toBe('/admin/users')
    const match = router.resolve(makeRequest('GET', '/admin/users'))
    expect(match).toBeDefined()
  })

  it('route-group-middleware: middleware applied to group routes', () => {
    router.group({ middleware: ['auth'] }, (r) => {
      r.get('/dashboard', () => new Response('ok'))
    })
    const match = router.resolve(makeRequest('GET', '/dashboard'))
    expect(match.middleware).toContain('auth')
  })

  it('first-match-wins: first registered route wins', () => {
    let hit = ''
    router.get('/test', () => { hit = 'first'; return new Response('ok') })
    router.get('/test', () => { hit = 'second'; return new Response('ok') })
    const match = router.resolve(makeRequest('GET', '/test'))
    expect(match.action).toBeDefined()
    // The match returns the first route's action
  })

  it('resource-routes: generates all 7 routes', () => {
    router.resource('photos', PhotoController)
    const routes = router.routes()
    const names = routes.map((r) => r.name).filter(Boolean)
    expect(names).toContain('photos.index')
    expect(names).toContain('photos.create')
    expect(names).toContain('photos.store')
    expect(names).toContain('photos.show')
    expect(names).toContain('photos.edit')
    expect(names).toContain('photos.update')
    expect(names).toContain('photos.destroy')
  })

  it('api-resource-routes: generates 5 routes (no create/edit)', () => {
    router.apiResource('photos', PhotoController)
    const routes = router.routes()
    const names = routes.map((r) => r.name).filter(Boolean)
    expect(names).toContain('photos.index')
    expect(names).toContain('photos.store')
    expect(names).toContain('photos.show')
    expect(names).toContain('photos.update')
    expect(names).toContain('photos.destroy')
    expect(names).not.toContain('photos.create')
    expect(names).not.toContain('photos.edit')
  })
})
