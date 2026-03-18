import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { User } from '../../Models/User.ts'

export class HomeController {
  /** GET / */
  async index(_request: MantiqRequest): Promise<Response> {
    const users = await User.all()

    return MantiqResponse.html(
      await vite().page({
        entry: ['src/style.css', 'src/main.tsx'],
        title: config('app.name'),
        data: {
          appName: config('app.name'),
          users: users.map((u) => u.toObject()),
        },
      }),
    )
  }
}
