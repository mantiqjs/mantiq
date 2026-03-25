import type { Router } from '@mantiq/core'
import { PageController } from '../app/Http/Controllers/PageController.ts'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'

export default function (router: Router) {
  const page = new PageController()
  const authCtrl = new AuthController()

  router.get('/', async (req) => page.chat(req)).middleware('auth')
  router.get('/login', async (req) => page.login(req)).middleware('guest')
  router.get('/register', async (req) => page.register(req)).middleware('guest')
  router.get('/chat', async (req) => page.chat(req)).middleware('auth')

  router.post('/login', async (req) => authCtrl.login(req))
  router.post('/register', async (req) => authCtrl.register(req))
  router.post('/logout', async (req) => authCtrl.logout(req)).middleware('auth')
}
