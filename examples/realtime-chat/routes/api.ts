import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { RoomController } from '../app/Http/Controllers/RoomController.ts'
import { MemberController } from '../app/Http/Controllers/MemberController.ts'
import { MessageController } from '../app/Http/Controllers/MessageController.ts'
import { ReactionController } from '../app/Http/Controllers/ReactionController.ts'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'

export default function (router: Router) {
  const rooms = new RoomController()
  const members = new MemberController()
  const messages = new MessageController()
  const reactions = new ReactionController()
  const authCtrl = new AuthController()

  // Health check
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Auth
  router.get('/api/me', async (req) => authCtrl.me(req)).middleware('auth')

  // Rooms
  router.get('/api/rooms', async (req) => rooms.index(req)).middleware('auth')
  router.post('/api/rooms', async (req) => rooms.create(req)).middleware('auth')
  router.post('/api/rooms/direct', async (req) => rooms.createDirect(req)).middleware('auth')
  router.get('/api/rooms/:id', async (req) => rooms.show(req)).middleware('auth')
  router.put('/api/rooms/:id', async (req) => rooms.update(req)).middleware('auth')
  router.delete('/api/rooms/:id', async (req) => rooms.destroy(req)).middleware('auth')

  // Room members
  router.get('/api/rooms/:roomId/members', async (req) => members.index(req)).middleware('auth')
  router.post('/api/rooms/:roomId/members', async (req) => members.invite(req)).middleware('auth')
  router.delete('/api/rooms/:roomId/members/:userId', async (req) => members.remove(req)).middleware('auth')
  router.patch('/api/rooms/:roomId/members/:userId/role', async (req) => members.updateRole(req)).middleware('auth')
  router.post('/api/rooms/:roomId/leave', async (req) => members.leave(req)).middleware('auth')
  router.post('/api/rooms/:roomId/mute', async (req) => members.mute(req)).middleware('auth')
  router.post('/api/rooms/:roomId/unmute', async (req) => members.unmute(req)).middleware('auth')

  // Messages
  router.get('/api/rooms/:roomId/messages', async (req) => messages.index(req)).middleware('auth')
  router.post('/api/rooms/:roomId/messages', async (req) => messages.send(req)).middleware('auth')
  router.put('/api/messages/:messageId', async (req) => messages.edit(req)).middleware('auth')
  router.delete('/api/messages/:messageId', async (req) => messages.destroy(req)).middleware('auth')
  router.get('/api/rooms/:roomId/messages/search', async (req) => messages.search(req)).middleware('auth')

  // Reactions
  router.post('/api/messages/:messageId/reactions', async (req) => reactions.add(req)).middleware('auth')
  router.delete('/api/messages/:messageId/reactions', async (req) => reactions.remove(req)).middleware('auth')
}
