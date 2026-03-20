import type { Router } from '@mantiq/core'
import { ApiController } from '@app/Http/Controllers/ApiController.ts'
import { UserController } from '@app/Http/Controllers/UserController.ts'
import { ValidationController } from '@app/Http/Controllers/ValidationController.ts'
import { StorageController } from '@app/Http/Controllers/StorageController.ts'
import { ChatController } from '@app/Http/Controllers/ChatController.ts'

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

    // Storage playground — public
    r.post('/storage/write', [StorageController, 'write'])
    r.get('/storage/read', [StorageController, 'read'])
    r.get('/storage/list', [StorageController, 'list'])
    r.delete('/storage/delete', [StorageController, 'destroy'])
    r.get('/storage/info', [StorageController, 'info'])
    r.post('/storage/upload', [StorageController, 'upload'])

    // Chat file upload & serving
    r.post('/chat/upload', [ChatController, 'upload'])
    r.get('/chat/files/:filename', [ChatController, 'serve'])

    // SSE endpoints
    r.get('/chat/sse', [ChatController, 'stream'])
    r.post('/chat/sse/broadcast', [ChatController, 'sseBroadcast'])
    r.get('/chat/sse/stats', [ChatController, 'sseStats'])

    // SSE user stream (before apiResource so it doesn't match :user param)
    r.get('/users/stream', [UserController, 'stream'])

    // Protected routes — require authentication
    r.group({ middleware: ['auth'] }, (auth) => {
      auth.apiResource('users', UserController)
    })
  })
}
