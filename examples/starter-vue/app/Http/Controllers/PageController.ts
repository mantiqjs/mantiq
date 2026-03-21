import type { MantiqRequest } from '@mantiq/core'
import { config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

async function getUser(request: MantiqRequest) {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user()
  if (!user) return null
  return {
    id: (user as any).getAttribute?.('id') ?? user.getAuthIdentifier(),
    name: (user as any).getAttribute?.('name') ?? '',
    email: (user as any).getAttribute?.('email') ?? '',
  }
}

function render(request: MantiqRequest, page: string, title: string, data: Record<string, any> = {}) {
  return vite().render(request, {
    page,
    entry: ['src/style.css', 'src/main.ts'],
    title: config('app.name') + ' — ' + title,
    data: { appName: config('app.name'), ...data },
  })
}

export class PageController {
  async dashboard(request: MantiqRequest): Promise<Response> {
    const currentUser = await getUser(request)
    const users = await User.all()
    return render(request, 'Dashboard', 'Dashboard', {
      currentUser,
      users: users.map((u: any) => u.toObject()),
    })
  }

  async login(request: MantiqRequest): Promise<Response> {
    return render(request, 'Login', 'Sign In')
  }

  async register(request: MantiqRequest): Promise<Response> {
    return render(request, 'Register', 'Register')
  }

  async users(request: MantiqRequest): Promise<Response> {
    const currentUser = await getUser(request)
    const users = await User.all()
    return render(request, 'Users', 'Users', {
      currentUser,
      users: users.map((u: any) => u.toObject()),
    })
  }

  async profile(request: MantiqRequest): Promise<Response> {
    return render(request, 'Profile', 'Profile', { currentUser: await getUser(request) })
  }

  async security(request: MantiqRequest): Promise<Response> {
    return render(request, 'Security', 'Security', { currentUser: await getUser(request) })
  }

  async preferences(request: MantiqRequest): Promise<Response> {
    return render(request, 'Preferences', 'Preferences', { currentUser: await getUser(request) })
  }
}
