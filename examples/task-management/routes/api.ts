import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { ProjectController } from '../app/Http/Controllers/ProjectController.ts'
import { TaskController } from '../app/Http/Controllers/TaskController.ts'
import { LabelController } from '../app/Http/Controllers/LabelController.ts'

export default function (router: Router) {
  const authController = new AuthController()
  const projectController = new ProjectController()
  const taskController = new TaskController()
  const labelController = new LabelController()

  // ── Health check ────────────────────────────────────────────────────────────
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ── Auth (public) ──────────────────────────────────────────────────────────
  router.post('/api/auth/register', (req: any) => authController.register(req))
  router.post('/api/auth/login', (req: any) => authController.login(req))

  // ── Auth (protected) ──────────────────────────────────────────────────────
  router.post('/api/auth/logout', (req: any) => authController.logout(req))
    .middleware('auth')
  router.get('/api/auth/me', (req: any) => authController.me(req))
    .middleware('auth')

  // ── Projects ──────────────────────────────────────────────────────────────
  router.get('/api/projects', (req: any) => projectController.index(req))
    .middleware('auth')
  router.post('/api/projects', (req: any) => projectController.store(req))
    .middleware('auth')
  router.get('/api/projects/:id', (req: any) => projectController.show(req))
    .middleware('auth')
    .whereNumber('id')
  router.put('/api/projects/:id', (req: any) => projectController.update(req))
    .middleware('auth')
    .whereNumber('id')
  router.delete('/api/projects/:id', (req: any) => projectController.destroy(req))
    .middleware('auth')
    .whereNumber('id')
  router.patch('/api/projects/:id/archive', (req: any) => projectController.archive(req))
    .middleware('auth')
    .whereNumber('id')

  // ── Tasks (scoped to project) ─────────────────────────────────────────────
  router.get('/api/projects/:projectId/tasks', (req: any) => taskController.index(req))
    .middleware('auth')
  router.post('/api/projects/:projectId/tasks', (req: any) => taskController.store(req))
    .middleware('auth')

  // ── Tasks (by ID) ─────────────────────────────────────────────────────────
  router.get('/api/tasks/:id', (req: any) => taskController.show(req))
    .middleware('auth')
    .whereNumber('id')
  router.put('/api/tasks/:id', (req: any) => taskController.update(req))
    .middleware('auth')
    .whereNumber('id')
  router.delete('/api/tasks/:id', (req: any) => taskController.destroy(req))
    .middleware('auth')
    .whereNumber('id')
  router.patch('/api/tasks/:id/assign', (req: any) => taskController.assign(req))
    .middleware('auth')
    .whereNumber('id')
  router.patch('/api/tasks/:id/move', (req: any) => taskController.move(req))
    .middleware('auth')
    .whereNumber('id')
  router.patch('/api/tasks/:id/reorder', (req: any) => taskController.reorder(req))
    .middleware('auth')
    .whereNumber('id')

  // ── Labels (scoped to project) ────────────────────────────────────────────
  router.get('/api/projects/:projectId/labels', (req: any) => labelController.index(req))
    .middleware('auth')
  router.post('/api/projects/:projectId/labels', (req: any) => labelController.store(req))
    .middleware('auth')

  // ── Labels (by ID) ────────────────────────────────────────────────────────
  router.put('/api/labels/:id', (req: any) => labelController.update(req))
    .middleware('auth')
    .whereNumber('id')
  router.delete('/api/labels/:id', (req: any) => labelController.destroy(req))
    .middleware('auth')
    .whereNumber('id')

  // ── Label ↔ Task pivot ────────────────────────────────────────────────────
  router.post('/api/tasks/:taskId/labels/:labelId', (req: any) => labelController.attach(req))
    .middleware('auth')
  router.delete('/api/tasks/:taskId/labels/:labelId', (req: any) => labelController.detach(req))
    .middleware('auth')
}
