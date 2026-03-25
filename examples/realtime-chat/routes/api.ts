import type { Router } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { RoomController } from '../app/Http/Controllers/RoomController.ts'
import { MemberController } from '../app/Http/Controllers/MemberController.ts'
import { MessageController } from '../app/Http/Controllers/MessageController.ts'
import { ReactionController } from '../app/Http/Controllers/ReactionController.ts'

export default function (router: Router) {
  const authCtrl = new AuthController()
  const room = new RoomController()
  const member = new MemberController()
  const message = new MessageController()
  const reaction = new ReactionController()

  // Auth
  router.post('/api/auth/register', async (req) => authCtrl.register(req))
  router.post('/api/auth/login', async (req) => authCtrl.login(req))
  router.post('/api/auth/logout', async (req) => authCtrl.logout(req)).middleware('auth')
  router.get('/api/auth/me', async (req) => authCtrl.me(req)).middleware('auth')

  // Rooms
  router.get('/api/rooms', async (req) => room.index(req)).middleware('auth')
  router.post('/api/rooms', async (req) => room.create(req)).middleware('auth')
  router.get('/api/rooms/:id', async (req) => room.show(req)).whereNumber('id').middleware('auth')
  router.put('/api/rooms/:id', async (req) => room.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/rooms/:id', async (req) => room.delete(req)).whereNumber('id').middleware('auth')
  router.post('/api/rooms/direct', async (req) => room.createDirect(req)).middleware('auth')

  // Members
  router.get('/api/rooms/:roomId/members', async (req) => member.index(req)).middleware('auth')
  router.post('/api/rooms/:roomId/members', async (req) => member.invite(req)).middleware('auth')
  router.delete('/api/rooms/:roomId/members/:userId', async (req) => member.remove(req)).middleware('auth')
  router.patch('/api/rooms/:roomId/members/:userId/role', async (req) => member.updateRole(req)).middleware('auth')
  router.post('/api/rooms/:roomId/leave', async (req) => member.leave(req)).middleware('auth')
  router.patch('/api/rooms/:roomId/mute', async (req) => member.mute(req)).middleware('auth')
  router.patch('/api/rooms/:roomId/unmute', async (req) => member.unmute(req)).middleware('auth')

  // Messages
  router.get('/api/rooms/:roomId/messages', async (req) => message.index(req)).middleware('auth')
  router.post('/api/rooms/:roomId/messages', async (req) => message.send(req)).middleware('auth')
  router.put('/api/messages/:id', async (req) => message.edit(req)).whereNumber('id').middleware('auth')
  router.delete('/api/messages/:id', async (req) => message.destroy(req)).whereNumber('id').middleware('auth')
  router.get('/api/rooms/:roomId/messages/search', async (req) => message.search(req)).middleware('auth')

  // Reactions
  router.post('/api/messages/:messageId/reactions', async (req) => reaction.add(req)).middleware('auth')
  router.delete('/api/messages/:messageId/reactions/:emoji', async (req) => reaction.remove(req)).middleware('auth')
}
