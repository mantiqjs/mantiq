import type { Router } from '@mantiq/core'
import { HomeController } from '@app/Http/Controllers/HomeController.ts'
import { AuthController } from '@app/Http/Controllers/AuthController.ts'

export default function (router: Router) {
  router.get('/', [HomeController, 'index'])
  router.get('/validation', [HomeController, 'validation'])
  router.get('/cli', [HomeController, 'cli'])
  router.get('/storage', [HomeController, 'storage'])

  // Auth routes
  router.post('/register', [AuthController, 'register'])
  router.post('/login', [AuthController, 'login'])
  router.post('/logout', [AuthController, 'logout']).middleware('auth')
  router.get('/me', [AuthController, 'me']).middleware('auth')

  // This route intentionally throws to test the dev error page
  router.get('/broken', () => {
    throw new Error('This is a deliberate error to test the dev error page.')
  })
}
