import type { Router } from '@mantiq/core'
import { redirect, json } from '@mantiq/core'
import { PageController } from '@app/Http/Controllers/PageController.ts'
import { AuthController } from '@app/Http/Controllers/AuthController.ts'

export default function (router: Router) {
  // Redirect root to dashboard
  router.get('/', () => redirect('/dashboard'))

  // Page routes — each returns HTML (first load) or JSON (client navigation)
  router.get('/dashboard', [PageController, 'dashboard']).middleware('auth')
  router.get('/login', [PageController, 'login']).middleware('guest')
  router.get('/register', [PageController, 'register']).middleware('guest')

  router.get('/health', (request) => {
    return json({ status: 'ok', timestamp: new Date().toISOString(), request: request })
  })

  // Auth actions
  router.post('/login', [AuthController, 'login'])
  router.post('/register', [AuthController, 'register'])
  router.post('/logout', [AuthController, 'logout']).middleware('auth')
}
