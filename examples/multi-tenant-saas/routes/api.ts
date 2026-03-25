import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { TenantController } from '../app/Http/Controllers/TenantController.ts'
import { UserController } from '../app/Http/Controllers/UserController.ts'
import { InvitationController } from '../app/Http/Controllers/InvitationController.ts'
import { PlanController } from '../app/Http/Controllers/PlanController.ts'
import { SubscriptionController } from '../app/Http/Controllers/SubscriptionController.ts'
import { AuditController } from '../app/Http/Controllers/AuditController.ts'

export default function (router: Router) {
  const authCtrl = new AuthController()
  const tenantCtrl = new TenantController()
  const userCtrl = new UserController()
  const invitationCtrl = new InvitationController()
  const planCtrl = new PlanController()
  const subscriptionCtrl = new SubscriptionController()
  const auditCtrl = new AuditController()

  // ── Health check ────────────────────────────────────────────────────────────
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────
  router.post('/api/auth/register', (req: any) => authCtrl.register(req))
  router.post('/api/auth/login', (req: any) => authCtrl.login(req))
  router.post('/api/auth/logout', (req: any) => authCtrl.logout(req)).middleware('auth')
  router.get('/api/auth/me', (req: any) => authCtrl.me(req)).middleware('auth')

  // ── Tenant ──────────────────────────────────────────────────────────────────
  router.get('/api/tenant', (req: any) => tenantCtrl.show(req)).middleware('auth')
  router.put('/api/tenant', (req: any) => tenantCtrl.update(req)).middleware('auth')
  router.get('/api/tenant/members', (req: any) => tenantCtrl.members(req)).middleware('auth')
  router.get('/api/tenant/stats', (req: any) => tenantCtrl.stats(req)).middleware('auth')

  // ── Users ───────────────────────────────────────────────────────────────────
  router.get('/api/users', (req: any) => userCtrl.index(req)).middleware('auth')
  router.get('/api/users/:id', (req: any) => userCtrl.show(req)).whereNumber('id').middleware('auth')
  router.put('/api/users/:id', (req: any) => userCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/users/:id', (req: any) => userCtrl.remove(req)).whereNumber('id').middleware('auth')

  // ── Invitations ─────────────────────────────────────────────────────────────
  router.get('/api/invitations', (req: any) => invitationCtrl.index(req)).middleware('auth')
  router.post('/api/invitations', (req: any) => invitationCtrl.invite(req)).middleware('auth')
  router.post('/api/invitations/:token/accept', (req: any) => invitationCtrl.accept(req))
  router.delete('/api/invitations/:id', (req: any) => invitationCtrl.revoke(req)).whereNumber('id').middleware('auth')

  // ── Plans (public) ──────────────────────────────────────────────────────────
  router.get('/api/plans', (req: any) => planCtrl.index(req))
  router.get('/api/plans/:id', (req: any) => planCtrl.show(req)).whereNumber('id')

  // ── Subscriptions ───────────────────────────────────────────────────────────
  router.get('/api/subscription', (req: any) => subscriptionCtrl.current(req)).middleware('auth')
  router.post('/api/subscription', (req: any) => subscriptionCtrl.subscribe(req)).middleware('auth')
  router.post('/api/subscription/cancel', (req: any) => subscriptionCtrl.cancel(req)).middleware('auth')
  router.post('/api/subscription/resume', (req: any) => subscriptionCtrl.resume(req)).middleware('auth')

  // ── Audit Logs ──────────────────────────────────────────────────────────────
  router.get('/api/audit-logs', (req: any) => auditCtrl.index(req)).middleware('auth')
  router.get('/api/audit-logs/:id', (req: any) => auditCtrl.show(req)).whereNumber('id').middleware('auth')
}
