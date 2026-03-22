import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

export default function (router: Router) {
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })
}
