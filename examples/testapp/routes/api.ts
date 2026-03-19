import type { Router } from '@mantiq/core'
import { json } from '@mantiq/core'

export default function (router: Router) {
  router.get('/api/ping', () => {
    return json({ status: 'ok', timestamp: new Date().toISOString() })
  })
}
