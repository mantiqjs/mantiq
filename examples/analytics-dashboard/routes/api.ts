import type { Router } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { MetricController } from '../app/Http/Controllers/MetricController.ts'
import { AlertController } from '../app/Http/Controllers/AlertController.ts'
import { DashboardController } from '../app/Http/Controllers/DashboardController.ts'
import { HealthController } from '../app/Http/Controllers/HealthController.ts'

export default function (router: Router) {
  const auth = new AuthController()
  const metric = new MetricController()
  const alert = new AlertController()
  const dashboard = new DashboardController()
  const health = new HealthController()

  // Auth
  router.post('/api/auth/register', async (req) => auth.register(req))
  router.post('/api/auth/login', async (req) => auth.login(req))
  router.post('/api/auth/logout', async (req) => auth.logout(req)).middleware('auth')
  router.get('/api/auth/me', async (req) => auth.me(req)).middleware('auth')

  // Metrics
  router.post('/api/metrics', async (req) => metric.ingest(req)).middleware('auth')
  router.get('/api/metrics', async (req) => metric.query(req)).middleware('auth')
  router.get('/api/metrics/names', async (req) => metric.names(req)).middleware('auth')
  router.get('/api/metrics/latest', async (req) => metric.latest(req)).middleware('auth')
  router.get('/api/metrics/summary', async (req) => metric.summary(req)).middleware('auth')

  // Alerts
  router.get('/api/alerts', async (req) => alert.index(req)).middleware('auth')
  router.post('/api/alerts', async (req) => alert.store(req)).middleware('auth')
  router.put('/api/alerts/:id', async (req) => alert.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/alerts/:id', async (req) => alert.destroy(req)).whereNumber('id').middleware('auth')
  router.patch('/api/alerts/:id/toggle', async (req) => alert.toggle(req)).whereNumber('id').middleware('auth')
  router.get('/api/alerts/:id/events', async (req) => alert.events(req)).whereNumber('id').middleware('auth')
  router.patch('/api/alert-events/:id/ack', async (req) => alert.acknowledge(req)).whereNumber('id').middleware('auth')
  router.post('/api/alerts/:id/check', async (req) => alert.check(req)).whereNumber('id').middleware('auth')

  // Dashboards
  router.get('/api/dashboards', async (req) => dashboard.index(req)).middleware('auth')
  router.post('/api/dashboards', async (req) => dashboard.store(req)).middleware('auth')
  router.get('/api/dashboards/:id', async (req) => dashboard.show(req)).whereNumber('id').middleware('auth')
  router.put('/api/dashboards/:id', async (req) => dashboard.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/dashboards/:id', async (req) => dashboard.destroy(req)).whereNumber('id').middleware('auth')

  // Health
  router.get('/api/health/status', async (req) => health.status(req))
  router.get('/api/health/readiness', async (req) => health.readiness(req))
  router.get('/api/health/liveness', async (req) => health.liveness(req))
}
