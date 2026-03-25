import type { Router } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { FolderController } from '../app/Http/Controllers/FolderController.ts'
import { FileController } from '../app/Http/Controllers/FileController.ts'
import { ShareController } from '../app/Http/Controllers/ShareController.ts'

export default function (router: Router) {
  const authCtrl = new AuthController()
  const folderCtrl = new FolderController()
  const fileCtrl = new FileController()
  const shareCtrl = new ShareController()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  router.post('/api/auth/register', (req: any) => authCtrl.register(req))
  router.post('/api/auth/login', (req: any) => authCtrl.login(req))
  router.post('/api/auth/logout', (req: any) => authCtrl.logout(req)).middleware('auth')
  router.get('/api/auth/me', (req: any) => authCtrl.me(req)).middleware('auth')

  // ── Folders ──────────────────────────────────────────────────────────────────
  router.get('/api/folders', (req: any) => folderCtrl.index(req)).middleware('auth')
  router.post('/api/folders', (req: any) => folderCtrl.store(req)).middleware('auth')
  router.get('/api/folders/:id', (req: any) => folderCtrl.show(req)).whereNumber('id').middleware('auth')
  router.put('/api/folders/:id', (req: any) => folderCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/folders/:id', (req: any) => folderCtrl.destroy(req)).whereNumber('id').middleware('auth')

  // ── Files ────────────────────────────────────────────────────────────────────
  router.get('/api/files', (req: any) => fileCtrl.index(req)).middleware('auth')
  router.post('/api/files/upload', (req: any) => fileCtrl.upload(req)).middleware('auth')
  router.get('/api/files/:id', (req: any) => fileCtrl.show(req)).whereNumber('id').middleware('auth')
  router.get('/api/files/:id/download', (req: any) => fileCtrl.download(req)).whereNumber('id').middleware('auth')
  router.put('/api/files/:id', (req: any) => fileCtrl.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/files/:id', (req: any) => fileCtrl.destroy(req)).whereNumber('id').middleware('auth')
  router.post('/api/files/:id/duplicate', (req: any) => fileCtrl.duplicate(req)).whereNumber('id').middleware('auth')

  // ── Share links ──────────────────────────────────────────────────────────────
  router.get('/api/files/:fileId/shares', (req: any) => shareCtrl.index(req)).middleware('auth')
  router.post('/api/files/:fileId/shares', (req: any) => shareCtrl.create(req)).middleware('auth')
  router.delete('/api/shares/:id', (req: any) => shareCtrl.revoke(req)).whereNumber('id').middleware('auth')

  // ── Public share access ──────────────────────────────────────────────────────
  router.get('/api/shared/:token', (req: any) => shareCtrl.access(req))
}
