import type { Router } from '@mantiq/core'
import { ApiController } from '../app/Http/Controllers/ApiController.ts'
import { UserController } from '../app/Http/Controllers/UserController.ts'

export default function (router: Router) {
  router.group({ prefix: '/api' }, (r) => {
    r.get('/ping', [ApiController, 'ping'])
    r.post('/echo', [ApiController, 'echo'])

    r.apiResource('users', UserController)
  })
}
