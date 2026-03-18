import type { Router } from '@mantiq/core'
import { HomeController } from '../app/Http/Controllers/HomeController.ts'

export default function (router: Router) {
  router.get('/', [HomeController, 'index'])

  // This route intentionally throws to test the dev error page
  router.get('/broken', () => {
    throw new Error('This is a deliberate error to test the dev error page.')
  })
}
