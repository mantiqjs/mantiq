import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { PostController } from '../app/Http/Controllers/PostController.ts'
import { CategoryController } from '../app/Http/Controllers/CategoryController.ts'
import { TagController } from '../app/Http/Controllers/TagController.ts'
import { CommentController } from '../app/Http/Controllers/CommentController.ts'

export default function (router: Router) {
  const authCtrl = new AuthController()
  const postCtrl = new PostController()
  const categoryCtrl = new CategoryController()
  const tagCtrl = new TagController()
  const commentCtrl = new CommentController()

  // ── Health check ────────────────────────────────────────────────────────────
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────
  router.post('/api/auth/register', (req: any) => authCtrl.register(req))
  router.post('/api/auth/login', (req: any) => authCtrl.login(req))
  router.post('/api/auth/logout', (req: any) => authCtrl.logout(req)).middleware('auth')
  router.get('/api/auth/me', (req: any) => authCtrl.me(req)).middleware('auth')

  // ── Posts ───────────────────────────────────────────────────────────────────
  router.get('/api/posts', (req: any) => postCtrl.index(req))
  router.get('/api/posts/slug/:slug', (req: any) => postCtrl.bySlug(req))
  router.get('/api/posts/:id', (req: any) => postCtrl.show(req)).whereNumber('id')
  router.post('/api/posts', (req: any) => postCtrl.store(req)).middleware('auth')
  router.put('/api/posts/:id', (req: any) => postCtrl.update(req)).whereNumber('id').middleware('auth')
  router.patch('/api/posts/:id/publish', (req: any) => postCtrl.publish(req)).whereNumber('id').middleware('auth')
  router.delete('/api/posts/:id', (req: any) => postCtrl.destroy(req)).whereNumber('id').middleware('auth')

  // ── Categories ──────────────────────────────────────────────────────────────
  router.get('/api/categories', (req: any) => categoryCtrl.index(req))
  router.get('/api/categories/:id', (req: any) => categoryCtrl.show(req)).whereNumber('id')
  router.post('/api/categories', (req: any) => categoryCtrl.store(req)).middleware('auth')
  router.put('/api/categories/:id', (req: any) => categoryCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/categories/:id', (req: any) => categoryCtrl.destroy(req)).whereNumber('id').middleware('auth')

  // ── Tags ────────────────────────────────────────────────────────────────────
  router.get('/api/tags', (req: any) => tagCtrl.index(req))
  router.get('/api/tags/:id', (req: any) => tagCtrl.show(req)).whereNumber('id')
  router.post('/api/tags', (req: any) => tagCtrl.store(req)).middleware('auth')
  router.put('/api/tags/:id', (req: any) => tagCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/tags/:id', (req: any) => tagCtrl.destroy(req)).whereNumber('id').middleware('auth')

  // ── Comments ────────────────────────────────────────────────────────────────
  router.get('/api/posts/:postId/comments', (req: any) => commentCtrl.index(req)).whereNumber('postId')
  router.post('/api/posts/:postId/comments', (req: any) => commentCtrl.store(req)).whereNumber('postId').middleware('auth')
  router.put('/api/comments/:id', (req: any) => commentCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/comments/:id', (req: any) => commentCtrl.destroy(req)).whereNumber('id').middleware('auth')
}
