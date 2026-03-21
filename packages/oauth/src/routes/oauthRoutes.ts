import type { Router } from '@mantiq/core'
import type { OAuthServer } from '../OAuthServer.ts'
import { TokenController } from './TokenController.ts'
import { AuthorizationController } from './AuthorizationController.ts'
import { ClientController } from './ClientController.ts'
import { ScopeController } from './ScopeController.ts'
import type { GrantHandler } from '../grants/GrantHandler.ts'

export interface OAuthRouteOptions {
  server: OAuthServer
  grants: GrantHandler[]
}

/**
 * Register all OAuth routes on a Router instance.
 */
export function oauthRoutes(router: Router, options: OAuthRouteOptions): void {
  const { server, grants } = options

  // Token controller
  const tokenController = new TokenController()
  for (const grant of grants) {
    tokenController.registerGrant(grant)
  }

  // Authorization controller
  const authorizationController = new AuthorizationController(server)

  // Client controller
  const clientController = new ClientController()

  // Scope controller
  const scopeController = new ScopeController(server)

  // ── Token endpoint (public) ─────────────────────────────────────────────
  router.post('/oauth/token', (req) => tokenController.issueToken(req))

  // ── Authorization endpoints ─────────────────────────────────────────────
  router.get('/oauth/authorize', (req) => authorizationController.authorize(req))
  router.post('/oauth/authorize', (req) => authorizationController.approve(req))
    .middleware('auth:oauth')
  router.delete('/oauth/authorize', (req) => authorizationController.deny(req))
    .middleware('auth:oauth')

  // ── Client CRUD (requires auth) ────────────────────────────────────────
  router.group({ prefix: '/oauth', middleware: ['auth:oauth'] }, (r) => {
    r.get('/clients', (req) => clientController.index(req))
    r.post('/clients', (req) => clientController.store(req))
    r.put('/clients/:id', (req) => clientController.update(req))
    r.delete('/clients/:id', (req) => clientController.destroy(req))
  })

  // ── Scopes endpoint ────────────────────────────────────────────────────
  router.get('/oauth/scopes', (req) => scopeController.index(req))
}
