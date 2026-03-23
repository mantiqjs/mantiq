import type { Router } from '@mantiq/core'
import { HomeController } from '../app/Http/Controllers/HomeController.ts'
import { PageController } from '../app/Http/Controllers/PageController.ts'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { RegisterRequest } from '../app/Http/Requests/RegisterRequest.ts'
import { LoginRequest } from '../app/Http/Requests/LoginRequest.ts'

export default function (router: Router) {
  router.get('/', [HomeController, 'index'])

  router.get('/dashboard', [PageController, 'dashboard']).middleware('auth')
  router.get('/login', [PageController, 'login']).middleware('guest')
  router.get('/register', [PageController, 'register']).middleware('guest')
  router.get('/users', [PageController, 'users']).middleware('auth')

  // Account settings
  router.get('/account/profile', [PageController, 'profile']).middleware('auth')
  router.get('/account/security', [PageController, 'security']).middleware('auth')
  router.get('/account/preferences', [PageController, 'preferences']).middleware('auth')

  // Auth actions — FormRequest auto-validates before controller runs
  router.post('/login', [AuthController, 'login', LoginRequest])
  router.post('/register', [AuthController, 'register', RegisterRequest])
  router.post('/logout', [AuthController, 'logout']).middleware('auth')
}
