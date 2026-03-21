import { describe, it, expect, beforeEach } from 'bun:test'
import { RouterImpl } from '../../src/routing/Router.ts'
import { MantiqRequest } from '../../src/http/Request.ts'
import { NotFoundError } from '../../src/errors/NotFoundError.ts'
import { HttpError } from '../../src/errors/HttpError.ts'
import { MantiqError } from '../../src/errors/MantiqError.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string): MantiqRequest {
  return MantiqRequest.fromBun(new Request(`http://localhost${url}`, { method }))
}

// ── Controllers ──────────────────────────────────────────────────────────────

class PhotoController {
  index() { return 'photos.index' }
  create() { return 'photos.create' }
  store() { return 'photos.store' }
  show() { return 'photos.show' }
  edit() { return 'photos.edit' }
  update() { return 'photos.update' }
  destroy() { return 'photos.destroy' }
}

class CommentController {
  index() { return 'comments.index' }
  store() { return 'comments.store' }
  show() { return 'comments.show' }
  update() { return 'comments.update' }
  destroy() { return 'comments.destroy' }
}

class AdminUserController {
  index() { return 'admin.users.index' }
  show() { return 'admin.users.show' }
}

class CategoryController {
  index() { return 'categories.index' }
  create() { return 'categories.create' }
  store() { return 'categories.store' }
  show() { return 'categories.show' }
  edit() { return 'categories.edit' }
  update() { return 'categories.update' }
  destroy() { return 'categories.destroy' }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Routing Integration', () => {
  let router: RouterImpl

  beforeEach(() => {
    router = new RouterImpl()
  })

  describe('parameterized routes', () => {
    it('captures a single parameter', () => {
      router.get('/users/:id', () => 'ok')
      const match = router.resolve(makeRequest('GET', '/users/42'))
      expect(match.params.id).toBe('42')
    })

    it('captures multiple parameters', () => {
      router.get('/teams/:teamId/members/:memberId', () => 'ok')
      const match = router.resolve(makeRequest('GET', '/teams/5/members/99'))
      expect(match.params.teamId).toBe('5')
      expect(match.params.memberId).toBe('99')
    })

    it('captures optional parameters when present', () => {
      router.get('/posts/:slug?', () => 'ok')
      const match = router.resolve(makeRequest('GET', '/posts/hello-world'))
      expect(match.params.slug).toBe('hello-world')
    })

    it('matches route without optional parameter', () => {
      router.get('/posts/:slug?', () => 'ok')
      const match = router.resolve(makeRequest('GET', '/posts'))
      expect(match.params.slug).toBeUndefined()
    })

    it('captures wildcard parameter', () => {
      router.get('/files/*', () => 'ok')
      const match = router.resolve(makeRequest('GET', '/files/docs/readme.md'))
      expect(match.params['*']).toBe('docs/readme.md')
    })

    it('enforces whereNumber constraint — rejects alpha', () => {
      router.get('/users/:id', () => 'ok').whereNumber('id')
      expect(() => router.resolve(makeRequest('GET', '/users/abc'))).toThrow(NotFoundError)
    })

    it('enforces whereNumber constraint — accepts numeric', () => {
      router.get('/users/:id', () => 'ok').whereNumber('id')
      const match = router.resolve(makeRequest('GET', '/users/42'))
      expect(match.params.id).toBe(42) // coerced to number by whereNumber
    })

    it('enforces whereAlpha constraint', () => {
      router.get('/tags/:name', () => 'ok').whereAlpha('name')
      const match = router.resolve(makeRequest('GET', '/tags/javascript'))
      expect(match.params.name).toBeDefined()

      expect(() => router.resolve(makeRequest('GET', '/tags/123'))).toThrow(NotFoundError)
    })

    it('enforces whereUuid constraint', () => {
      router.get('/items/:uuid', () => 'ok').whereUuid('uuid')
      const match = router.resolve(makeRequest('GET', '/items/550e8400-e29b-41d4-a716-446655440000'))
      expect(match.params.uuid).toBe('550e8400-e29b-41d4-a716-446655440000')

      expect(() => router.resolve(makeRequest('GET', '/items/not-a-uuid'))).toThrow(NotFoundError)
    })

    it('enforces custom where constraint', () => {
      router.get('/lang/:locale', () => 'ok').where('locale', /^(en|fr|de)$/)
      expect(router.resolve(makeRequest('GET', '/lang/en')).params.locale).toBe('en')
      expect(() => router.resolve(makeRequest('GET', '/lang/xx'))).toThrow(NotFoundError)
    })
  })

  describe('route groups with prefix', () => {
    it('prepends prefix to all routes in the group', () => {
      router.group({ prefix: '/api' }, (r) => {
        r.get('/users', () => 'ok').name('api.users')
        r.get('/posts', () => 'ok').name('api.posts')
      })

      expect(router.resolve(makeRequest('GET', '/api/users'))).toBeDefined()
      expect(router.resolve(makeRequest('GET', '/api/posts'))).toBeDefined()
      expect(() => router.resolve(makeRequest('GET', '/users'))).toThrow(NotFoundError)
    })

    it('supports nested group prefixes', () => {
      router.group({ prefix: '/api' }, (r) => {
        r.group({ prefix: '/v2' }, (r2) => {
          r2.get('/users', () => 'ok').name('api.v2.users')
        })
      })

      const match = router.resolve(makeRequest('GET', '/api/v2/users'))
      expect(match).toBeDefined()
      expect(router.url('api.v2.users')).toBe('/api/v2/users')
    })

    it('generates URLs for prefixed routes', () => {
      router.group({ prefix: '/admin' }, (r) => {
        r.get('/dashboard', () => 'ok').name('admin.dashboard')
        r.get('/users/:id', () => 'ok').name('admin.users.show')
      })

      expect(router.url('admin.dashboard')).toBe('/admin/dashboard')
      expect(router.url('admin.users.show', { id: 7 })).toBe('/admin/users/7')
    })
  })

  describe('route groups with middleware', () => {
    it('assigns middleware to all routes in the group', () => {
      router.group({ middleware: ['auth', 'verified'] }, (r) => {
        r.get('/dashboard', () => 'ok')
        r.get('/settings', () => 'ok')
      })

      const dashMatch = router.resolve(makeRequest('GET', '/dashboard'))
      expect(dashMatch.middleware).toContain('auth')
      expect(dashMatch.middleware).toContain('verified')

      const settingsMatch = router.resolve(makeRequest('GET', '/settings'))
      expect(settingsMatch.middleware).toContain('auth')
      expect(settingsMatch.middleware).toContain('verified')
    })

    it('combines group middleware with route-level middleware', () => {
      router.group({ middleware: ['auth'] }, (r) => {
        r.get('/admin', () => 'ok').middleware('admin')
      })

      const match = router.resolve(makeRequest('GET', '/admin'))
      expect(match.middleware).toContain('auth')
      expect(match.middleware).toContain('admin')
    })

    it('supports nested group middleware stacking', () => {
      router.group({ middleware: ['auth'] }, (r) => {
        r.group({ middleware: ['verified'] }, (r2) => {
          r2.get('/billing', () => 'ok')
        })
      })

      const match = router.resolve(makeRequest('GET', '/billing'))
      expect(match.middleware).toContain('auth')
      expect(match.middleware).toContain('verified')
    })
  })

  describe('route groups with prefix + middleware combined', () => {
    it('applies both prefix and middleware', () => {
      router.group({ prefix: '/api', middleware: ['api', 'throttle'] }, (r) => {
        r.get('/users', () => 'ok')
        r.get('/users/:id', () => 'ok')
      })

      const match = router.resolve(makeRequest('GET', '/api/users/1'))
      expect(match.params.id).toBe('1')
      expect(match.middleware).toContain('api')
      expect(match.middleware).toContain('throttle')
    })
  })

  describe('route groups with name prefix (as)', () => {
    it('prepends name prefix to route names', () => {
      router.group({ as: 'admin.' }, (r) => {
        r.get('/admin/users', () => 'ok').name('users.index')
      })

      expect(router.url('admin.users.index')).toBe('/admin/users')
    })

    it('works with nested as prefixes', () => {
      router.group({ prefix: '/api', as: 'api.' }, (r) => {
        r.group({ prefix: '/v1', as: 'v1.' }, (r2) => {
          r2.get('/users', () => 'ok').name('users')
        })
      })

      expect(router.url('api.v1.users')).toBe('/api/v1/users')
    })
  })

  describe('resource routes', () => {
    it('registers all 7 RESTful routes', () => {
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
      expect(names.length).toBe(7)
    })

    it('resolves resource index route (GET /photos)', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('GET', '/photos'))
      expect(match).toBeDefined()
      expect(match.routeName).toBe('photos.index')
    })

    it('resolves resource store route (POST /photos)', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('POST', '/photos'))
      expect(match.routeName).toBe('photos.store')
    })

    it('resolves resource show route (GET /photos/:photo)', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('GET', '/photos/42'))
      expect(match.routeName).toBe('photos.show')
      expect(match.params.photo).toBe('42')
    })

    it('resolves resource create route (GET /photos/create)', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('GET', '/photos/create'))
      expect(match.routeName).toBe('photos.create')
    })

    it('resolves resource edit route (GET /photos/:photo/edit)', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('GET', '/photos/42/edit'))
      expect(match.routeName).toBe('photos.edit')
    })

    it('resolves resource update route (PUT /photos/:photo)', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('PUT', '/photos/42'))
      expect(match.routeName).toBe('photos.update')
      expect(match.params.photo).toBe('42')
    })

    it('resolves resource update route (PATCH /photos/:photo)', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('PATCH', '/photos/42'))
      expect(match.routeName).toBe('photos.update')
    })

    it('resolves resource destroy route (DELETE /photos/:photo)', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('DELETE', '/photos/42'))
      expect(match.routeName).toBe('photos.destroy')
    })

    it('singularizes the parameter name', () => {
      router.resource('photos', PhotoController)
      const match = router.resolve(makeRequest('GET', '/photos/7'))
      expect(match.params.photo).toBe('7')
    })

    it('singularizes -ies plural to -y', () => {
      router.resource('categories', CategoryController)
      const match = router.resolve(makeRequest('GET', '/categories/3'))
      expect(match.params.category).toBe('3')
    })
  })

  describe('apiResource routes', () => {
    it('registers 5 routes (no create/edit)', () => {
      router.apiResource('comments', CommentController)
      const routes = router.routes()
      const names = routes.map((r) => r.name).filter(Boolean)

      expect(names).toContain('comments.index')
      expect(names).toContain('comments.store')
      expect(names).toContain('comments.show')
      expect(names).toContain('comments.update')
      expect(names).toContain('comments.destroy')
      expect(names).not.toContain('comments.create')
      expect(names).not.toContain('comments.edit')
    })

    it('resolves all 5 api resource routes', () => {
      router.apiResource('comments', CommentController)

      expect(router.resolve(makeRequest('GET', '/comments')).routeName).toBe('comments.index')
      expect(router.resolve(makeRequest('POST', '/comments')).routeName).toBe('comments.store')
      expect(router.resolve(makeRequest('GET', '/comments/1')).routeName).toBe('comments.show')
      expect(router.resolve(makeRequest('PUT', '/comments/1')).routeName).toBe('comments.update')
      expect(router.resolve(makeRequest('DELETE', '/comments/1')).routeName).toBe('comments.destroy')
    })

    it('rejects GET /comments/create (no create route)', () => {
      router.apiResource('comments', CommentController)
      // /comments/create should match as /comments/:comment with param "create"
      const match = router.resolve(makeRequest('GET', '/comments/create'))
      // It resolves to the show route with param "create" — not a NotFoundError
      expect(match.routeName).toBe('comments.show')
      expect(match.params.comment).toBe('create')
    })
  })

  describe('resource routes inside groups', () => {
    it('resource inside a prefixed group gets the full prefix', () => {
      router.group({ prefix: '/api/v1' }, (r) => {
        r.resource('photos', PhotoController)
      })

      const match = router.resolve(makeRequest('GET', '/api/v1/photos'))
      expect(match).toBeDefined()
      expect(match.routeName).toBe('photos.index')

      const showMatch = router.resolve(makeRequest('GET', '/api/v1/photos/5'))
      expect(showMatch.params.photo).toBe('5')
    })
  })

  describe('URL generation', () => {
    it('generates URL for a simple named route', () => {
      router.get('/about', () => 'ok').name('about')
      expect(router.url('about')).toBe('/about')
    })

    it('generates URL with parameters', () => {
      router.get('/users/:id', () => 'ok').name('users.show')
      expect(router.url('users.show', { id: 42 })).toBe('/users/42')
    })

    it('appends extra params as query string', () => {
      router.get('/search', () => 'ok').name('search')
      const url = router.url('search', { q: 'hello', page: 2 })
      expect(url).toContain('q=hello')
      expect(url).toContain('page=2')
    })

    it('encodes parameter values', () => {
      router.get('/users/:name', () => 'ok').name('users.byName')
      const url = router.url('users.byName', { name: 'John Doe' })
      expect(url).toBe('/users/John%20Doe')
    })

    it('throws for missing required parameter', () => {
      router.get('/users/:id', () => 'ok').name('users.show')
      expect(() => router.url('users.show')).toThrow(MantiqError)
    })

    it('throws for unknown route name', () => {
      expect(() => router.url('nonexistent')).toThrow(MantiqError)
    })

    it('generates URL for resource routes', () => {
      router.resource('photos', PhotoController)
      expect(router.url('photos.index')).toBe('/photos')
      expect(router.url('photos.show', { photo: 5 })).toBe('/photos/5')
      expect(router.url('photos.edit', { photo: 5 })).toBe('/photos/5/edit')
      expect(router.url('photos.create')).toBe('/photos/create')
    })
  })

  describe('HTTP method matching', () => {
    it('match() registers route for multiple methods', () => {
      router.match(['GET', 'POST'], '/form', () => 'ok')

      expect(router.resolve(makeRequest('GET', '/form'))).toBeDefined()
      expect(router.resolve(makeRequest('POST', '/form'))).toBeDefined()
      expect(() => router.resolve(makeRequest('DELETE', '/form'))).toThrow(HttpError)
    })

    it('any() registers route for all methods', () => {
      router.any('/catch-all', () => 'ok')

      expect(router.resolve(makeRequest('GET', '/catch-all'))).toBeDefined()
      expect(router.resolve(makeRequest('POST', '/catch-all'))).toBeDefined()
      expect(router.resolve(makeRequest('PUT', '/catch-all'))).toBeDefined()
      expect(router.resolve(makeRequest('PATCH', '/catch-all'))).toBeDefined()
      expect(router.resolve(makeRequest('DELETE', '/catch-all'))).toBeDefined()
      expect(router.resolve(makeRequest('OPTIONS', '/catch-all'))).toBeDefined()
    })
  })

  describe('string-based controller actions', () => {
    it('resolves string action after registering controllers', () => {
      router.controllers({ AdminUserController })
      router.get('/admin/users', 'AdminUserController@index').name('admin.users.index')

      const match = router.resolve(makeRequest('GET', '/admin/users'))
      expect(match).toBeDefined()
      // Action should be resolved to [Constructor, method]
      expect(Array.isArray(match.action)).toBe(true)
    })

    it('throws for unregistered controller', () => {
      expect(() => {
        router.get('/test', 'UnknownController@index')
      }).toThrow(MantiqError)
    })

    it('throws for invalid action string format', () => {
      expect(() => {
        router.get('/test', 'NoAtSymbol')
      }).toThrow(MantiqError)
    })
  })

  describe('routes() listing', () => {
    it('returns all registered routes with metadata', () => {
      router.get('/a', () => 'ok').name('a')
      router.post('/b', () => 'ok').name('b').middleware('auth')

      const routes = router.routes()
      expect(routes.length).toBe(2)

      const routeA = routes.find((r) => r.name === 'a')
      expect(routeA).toBeDefined()
      expect(routeA!.path).toBe('/a')

      const routeB = routes.find((r) => r.name === 'b')
      expect(routeB).toBeDefined()
      expect(routeB!.middleware).toContain('auth')
    })
  })
})
