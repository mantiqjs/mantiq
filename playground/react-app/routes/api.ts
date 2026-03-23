import type { Router } from '@mantiq/core'
import { json } from '@mantiq/core'
import { UserController } from '../app/Http/Controllers/UserController.ts'
import { StoreUserRequest } from '../app/Http/Requests/StoreUserRequest.ts'
import { UpdateUserRequest } from '../app/Http/Requests/UpdateUserRequest.ts'

export default function (router: Router) {
  // Public
  router.get('/ping', () => json({ status: 'ok', timestamp: new Date().toISOString() }))

  // Protected — FormRequest auto-validates before controller runs
  router.get('/users', [UserController, 'index']).middleware('auth')
  router.post('/users', [UserController, 'store', StoreUserRequest]).middleware('auth')
  router.put('/users/:id', [UserController, 'update', UpdateUserRequest]).middleware('auth')
  router.delete('/users/:id', [UserController, 'destroy']).middleware('auth')
}
