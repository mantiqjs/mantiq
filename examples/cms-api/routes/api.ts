import type { Router } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { ContentTypeController } from '../app/Http/Controllers/ContentTypeController.ts'
import { EntryController } from '../app/Http/Controllers/EntryController.ts'
import { MediaController } from '../app/Http/Controllers/MediaController.ts'
import { TaxonomyController } from '../app/Http/Controllers/TaxonomyController.ts'

export default function (router: Router) {
  const authCtrl = new AuthController()
  const contentType = new ContentTypeController()
  const entry = new EntryController()
  const media = new MediaController()
  const taxonomy = new TaxonomyController()

  // Auth
  router.post('/api/auth/register', async (req) => authCtrl.register(req))
  router.post('/api/auth/login', async (req) => authCtrl.login(req))
  router.post('/api/auth/logout', async (req) => authCtrl.logout(req)).middleware('auth')
  router.get('/api/auth/me', async (req) => authCtrl.me(req)).middleware('auth')

  // Content Types (public read, auth for write)
  router.get('/api/content-types', async (req) => contentType.index(req))
  router.get('/api/content-types/:id', async (req) => contentType.show(req)).whereNumber('id')
  router.post('/api/content-types', async (req) => contentType.store(req)).middleware('auth')
  router.put('/api/content-types/:id', async (req) => contentType.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/content-types/:id', async (req) => contentType.destroy(req)).whereNumber('id').middleware('auth')

  // Entries (public read, auth for write)
  router.get('/api/entries', async (req) => entry.index(req))
  router.get('/api/entries/by-slug/:slug', async (req) => entry.bySlug(req))
  router.get('/api/entries/:id', async (req) => entry.show(req)).whereNumber('id')
  router.post('/api/entries', async (req) => entry.store(req)).middleware('auth')
  router.put('/api/entries/:id', async (req) => entry.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/entries/:id', async (req) => entry.destroy(req)).whereNumber('id').middleware('auth')
  router.patch('/api/entries/:id/publish', async (req) => entry.publish(req)).whereNumber('id').middleware('auth')
  router.patch('/api/entries/:id/unpublish', async (req) => entry.unpublish(req)).whereNumber('id').middleware('auth')
  router.get('/api/entries/:id/revisions', async (req) => entry.revisions(req)).whereNumber('id')
  router.post('/api/entries/:id/restore', async (req) => entry.restore(req)).whereNumber('id').middleware('auth')

  // Media (auth for all)
  router.get('/api/media', async (req) => media.index(req))
  router.get('/api/media/folders', async (req) => media.folders(req))
  router.get('/api/media/:id', async (req) => media.show(req)).whereNumber('id')
  router.post('/api/media', async (req) => media.upload(req)).middleware('auth')
  router.put('/api/media/:id', async (req) => media.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/media/:id', async (req) => media.destroy(req)).whereNumber('id').middleware('auth')

  // Taxonomies (public read, auth for write)
  router.get('/api/taxonomies', async (req) => taxonomy.index(req))
  router.get('/api/taxonomies/:id', async (req) => taxonomy.show(req)).whereNumber('id')
  router.get('/api/taxonomies/:id/entries', async (req) => taxonomy.entries(req)).whereNumber('id')
  router.post('/api/taxonomies', async (req) => taxonomy.store(req)).middleware('auth')
  router.put('/api/taxonomies/:id', async (req) => taxonomy.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/taxonomies/:id', async (req) => taxonomy.destroy(req)).whereNumber('id').middleware('auth')
  router.post('/api/taxonomies/attach', async (req) => taxonomy.attach(req)).middleware('auth')
  router.delete('/api/taxonomies/detach', async (req) => taxonomy.detach(req)).middleware('auth')
}
