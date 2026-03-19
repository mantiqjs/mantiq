import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { User } from '../app/Models/User.ts'

export default function (router: Router) {
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  router.get('/api/users', async () => {
    const users = await User.all()
    return MantiqResponse.json({ data: users.map((u: any) => u.toObject()) })
  }).middleware('auth')
}
