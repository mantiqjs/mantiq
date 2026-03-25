import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { ClientController } from '../app/Http/Controllers/ClientController.ts'
import { AuthorizationController } from '../app/Http/Controllers/AuthorizationController.ts'
import { TokenController } from '../app/Http/Controllers/TokenController.ts'
import { ScopeController } from '../app/Http/Controllers/ScopeController.ts'
import { PersonalTokenController } from '../app/Http/Controllers/PersonalTokenController.ts'

export default function (router: Router) {
  const authCtrl = new AuthController()
  const clientCtrl = new ClientController()
  const authzCtrl = new AuthorizationController()
  const tokenCtrl = new TokenController()
  const scopeCtrl = new ScopeController()
  const personalTokenCtrl = new PersonalTokenController()

  // ── Health check ────────────────────────────────────────────────────────────
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────
  router.post('/api/auth/register', (req: any) => authCtrl.register(req))
  router.post('/api/auth/login', (req: any) => authCtrl.login(req))
  router.post('/api/auth/logout', (req: any) => authCtrl.logout(req)).middleware('auth')
  router.get('/api/auth/me', (req: any) => authCtrl.me(req)).middleware('auth')

  // ── OAuth Clients ───────────────────────────────────────────────────────────
  router.get('/api/oauth/clients', (req: any) => clientCtrl.index(req)).middleware('auth')
  router.post('/api/oauth/clients', (req: any) => clientCtrl.store(req)).middleware('auth')
  router.get('/api/oauth/clients/:id', (req: any) => clientCtrl.show(req)).whereNumber('id').middleware('auth')
  router.put('/api/oauth/clients/:id', (req: any) => clientCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/oauth/clients/:id', (req: any) => clientCtrl.destroy(req)).whereNumber('id').middleware('auth')
  router.post('/api/oauth/clients/:id/regenerate-secret', (req: any) => clientCtrl.regenerateSecret(req)).whereNumber('id').middleware('auth')

  // ── OAuth Authorization ─────────────────────────────────────────────────────
  router.get('/api/oauth/authorize', (req: any) => authzCtrl.authorize(req)).middleware('auth')
  router.post('/api/oauth/authorize/approve', (req: any) => authzCtrl.approve(req)).middleware('auth')
  router.post('/api/oauth/authorize/deny', (req: any) => authzCtrl.deny(req)).middleware('auth')

  // ── OAuth Tokens (public) ───────────────────────────────────────────────────
  router.post('/api/oauth/token', (req: any) => tokenCtrl.token(req))
  router.post('/api/oauth/token/revoke', (req: any) => tokenCtrl.revoke(req))
  router.post('/api/oauth/token/introspect', (req: any) => tokenCtrl.introspect(req))

  // ── OAuth Scopes ────────────────────────────────────────────────────────────
  router.get('/api/oauth/scopes', (req: any) => scopeCtrl.index(req))

  // ── Personal Access Tokens ──────────────────────────────────────────────────
  router.get('/api/oauth/personal-tokens', (req: any) => personalTokenCtrl.index(req)).middleware('auth')
  router.post('/api/oauth/personal-tokens', (req: any) => personalTokenCtrl.store(req)).middleware('auth')
  router.delete('/api/oauth/personal-tokens/:id', (req: any) => personalTokenCtrl.revoke(req)).whereNumber('id').middleware('auth')
}
