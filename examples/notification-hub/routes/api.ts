import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { TemplateController } from '../app/Http/Controllers/TemplateController.ts'
import { NotificationController } from '../app/Http/Controllers/NotificationController.ts'
import { WebhookController } from '../app/Http/Controllers/WebhookController.ts'
import { GroupController } from '../app/Http/Controllers/GroupController.ts'

export default function (router: Router) {
  const authCtrl = new AuthController()
  const templateCtrl = new TemplateController()
  const notificationCtrl = new NotificationController()
  const webhookCtrl = new WebhookController()
  const groupCtrl = new GroupController()

  // ── Health check ────────────────────────────────────────────────────────────
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────
  router.post('/api/auth/register', (req: any) => authCtrl.register(req))
  router.post('/api/auth/login', (req: any) => authCtrl.login(req))
  router.post('/api/auth/logout', (req: any) => authCtrl.logout(req)).middleware('auth')
  router.get('/api/auth/me', (req: any) => authCtrl.me(req)).middleware('auth')
  router.put('/api/auth/preferences', (req: any) => authCtrl.updatePreferences(req)).middleware('auth')

  // ── Templates ───────────────────────────────────────────────────────────────
  router.get('/api/templates', (req: any) => templateCtrl.index(req)).middleware('auth')
  router.post('/api/templates', (req: any) => templateCtrl.store(req)).middleware('auth')
  router.get('/api/templates/:id', (req: any) => templateCtrl.show(req)).whereNumber('id').middleware('auth')
  router.put('/api/templates/:id', (req: any) => templateCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/templates/:id', (req: any) => templateCtrl.destroy(req)).whereNumber('id').middleware('auth')
  router.post('/api/templates/:id/preview', (req: any) => templateCtrl.preview(req)).whereNumber('id').middleware('auth')
  router.post('/api/templates/:id/test', (req: any) => templateCtrl.test(req)).whereNumber('id').middleware('auth')

  // ── Notifications ───────────────────────────────────────────────────────────
  router.post('/api/notifications/send', (req: any) => notificationCtrl.send(req)).middleware('auth')
  router.post('/api/notifications/bulk', (req: any) => notificationCtrl.sendBulk(req)).middleware('auth')
  router.get('/api/notifications/logs', (req: any) => notificationCtrl.logs(req)).middleware('auth')
  router.get('/api/notifications/logs/:id', (req: any) => notificationCtrl.show(req)).whereNumber('id').middleware('auth')
  router.post('/api/notifications/logs/:id/retry', (req: any) => notificationCtrl.retry(req)).whereNumber('id').middleware('auth')
  router.get('/api/notifications/stats', (req: any) => notificationCtrl.stats(req)).middleware('auth')

  // ── Webhooks ────────────────────────────────────────────────────────────────
  router.get('/api/webhooks', (req: any) => webhookCtrl.index(req)).middleware('auth')
  router.post('/api/webhooks', (req: any) => webhookCtrl.store(req)).middleware('auth')
  router.put('/api/webhooks/:id', (req: any) => webhookCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/webhooks/:id', (req: any) => webhookCtrl.destroy(req)).whereNumber('id').middleware('auth')
  router.post('/api/webhooks/:id/test', (req: any) => webhookCtrl.test(req)).whereNumber('id').middleware('auth')
  router.get('/api/webhooks/:id/deliveries', (req: any) => webhookCtrl.deliveries(req)).whereNumber('id').middleware('auth')

  // ── Groups ──────────────────────────────────────────────────────────────────
  router.get('/api/groups', (req: any) => groupCtrl.index(req)).middleware('auth')
  router.post('/api/groups', (req: any) => groupCtrl.store(req)).middleware('auth')
  router.post('/api/groups/:id/members', (req: any) => groupCtrl.addMembers(req)).whereNumber('id').middleware('auth')
  router.delete('/api/groups/:id/members', (req: any) => groupCtrl.removeMembers(req)).whereNumber('id').middleware('auth')
  router.post('/api/groups/:id/notify', (req: any) => groupCtrl.notify(req)).whereNumber('id').middleware('auth')
}
