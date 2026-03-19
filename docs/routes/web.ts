import type { Router } from '@mantiq/core'
import { DocsController } from '../app/Http/Controllers/DocsController.ts'

export default function (router: Router) {
  router.get('/', [DocsController, 'home'])
  router.get('/docs/:slug', [DocsController, 'show'])
}
