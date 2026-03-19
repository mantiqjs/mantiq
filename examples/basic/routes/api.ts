import type { Router } from '@mantiq/core'
import { ApiController } from '../app/Http/Controllers/ApiController.ts'
import { UserController } from '../app/Http/Controllers/UserController.ts'
import { ValidationController } from '../app/Http/Controllers/ValidationController.ts'

export default function (router: Router) {
  router.group({ prefix: '/api' }, (r) => {
    r.get('/ping', [ApiController, 'ping'])
    r.post('/echo', [ApiController, 'echo'])

    // Validation playground — public
    r.get('/validate/rules', [ValidationController, 'rules'])
    r.post('/validate/playground', [ValidationController, 'playground'])
    r.post('/validate/inline', [ValidationController, 'inline'])
    r.post('/validate/custom-rule', [ValidationController, 'customRule'])
    r.post('/validate/test', [ValidationController, 'test'])

    // Protected routes — require authentication
    r.group({ middleware: ['auth'] }, (auth) => {
      auth.apiResource('users', UserController)
    })
  })
}
