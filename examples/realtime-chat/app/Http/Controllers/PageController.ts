import type { MantiqRequest } from '@mantiq/core'
import { config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'
import { Room } from '../../Models/Room.ts'
import { RoomMember } from '../../Models/RoomMember.ts'

async function getUser(request: MantiqRequest) {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user()
  if (!user) return null
  return {
    id: (user as any).getAttribute?.('id') ?? user.getAuthIdentifier(),
    name: (user as any).getAttribute?.('name') ?? '',
    email: (user as any).getAttribute?.('email') ?? '',
    avatar_url: (user as any).getAttribute?.('avatar_url') ?? null,
    status: (user as any).getAttribute?.('status') ?? 'online',
  }
}

function render(request: MantiqRequest, page: string, title: string, data: Record<string, any> = {}) {
  return vite().render(request, {
    page,
    entry: ['src/style.css', 'src/main.tsx'],
    title: config('app.name') + ' — ' + title,
    data: { appName: config('app.name'), ...data },
  })
}

export class PageController {
  async login(request: MantiqRequest): Promise<Response> {
    return render(request, 'Login', 'Sign In')
  }

  async register(request: MantiqRequest): Promise<Response> {
    return render(request, 'Register', 'Create Account')
  }

  async chat(request: MantiqRequest): Promise<Response> {
    const currentUser = await getUser(request)
    if (!currentUser) return Response.redirect('/login')

    // Get rooms user is member of
    const memberships = await RoomMember.where('user_id', currentUser.id).get() as any[]
    const roomIds = memberships.map((m: any) => m.getAttribute('room_id') as number)

    const rooms: any[] = []
    for (const rid of roomIds) {
      const room = await Room.find(rid)
      if (room) {
        const memberCount = await (RoomMember.query().where('room_id', rid) as any).count() as number
        rooms.push({ ...room.toObject(), member_count: memberCount })
      }
    }

    return render(request, 'Chat', 'Chat', { currentUser, rooms })
  }
}
