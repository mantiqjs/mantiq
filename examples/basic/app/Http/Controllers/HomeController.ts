import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { auth } from '@mantiq/auth'

export class HomeController {
  /** GET / — serves the SPA shell with auth state */
  async index(request: MantiqRequest): Promise<Response> {
    // Try to resolve current user from session (no middleware required)
    const manager = auth()
    manager.setRequest(request)
    let currentUser = null
    try {
      const user = await manager.user()
      if (user) {
        currentUser = {
          id: (user as any).getAttribute?.('id') ?? user.getAuthIdentifier(),
          name: (user as any).getAttribute?.('name') ?? '',
          email: (user as any).getAttribute?.('email') ?? '',
          role: (user as any).getAttribute?.('role') ?? 'user',
        }
      }
    } catch {
      // Not authenticated — that's fine
    }

    return MantiqResponse.html(
      await vite().page({
        entry: ['src/style.css', 'src/main.tsx'],
        title: config('app.name'),
        data: {
          appName: config('app.name'),
          currentUser,
        },
      }),
    )
  }
}
