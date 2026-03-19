import type { MantiqRequest } from '@mantiq/core'
import { config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

export class PageController {
  async dashboard(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    const currentUser = user ? {
      id: (user as any).getAttribute?.('id') ?? user.getAuthIdentifier(),
      name: (user as any).getAttribute?.('name') ?? '',
      email: (user as any).getAttribute?.('email') ?? '',
      role: (user as any).getAttribute?.('role') ?? 'user',
    } : null

    const users = await User.all()

    return vite().render(request, {
      page: 'Dashboard',
      entry: ['src/style.css', 'src/main.ts'],
      title: config('app.name') + ' — Dashboard',
      data: {
        appName: config('app.name'),
        currentUser,
        users: users.map((u: any) => u.toObject()),
      },
    })
  }

  async login(request: MantiqRequest): Promise<Response> {
    return vite().render(request, {
      page: 'Login',
      entry: ['src/style.css', 'src/main.ts'],
      title: config('app.name') + ' — Sign In',
      data: { appName: config('app.name') },
    })
  }

  async register(request: MantiqRequest): Promise<Response> {
    return vite().render(request, {
      page: 'Register',
      entry: ['src/style.css', 'src/main.ts'],
      title: config('app.name') + ' — Register',
      data: { appName: config('app.name') },
    })
  }
}
