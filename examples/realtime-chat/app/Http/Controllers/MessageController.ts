import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Message } from '../../Models/Message.ts'
import { RoomMember } from '../../Models/RoomMember.ts'
import { User } from '../../Models/User.ts'

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

async function isMember(userId: number, roomId: number): Promise<boolean> {
  const member = await RoomMember.query().where('room_id', roomId).where('user_id', userId).first()
  return !!member
}

export class MessageController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))
    if (!(await isMember(userId, roomId))) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)
    }

    const limit = Math.min(100, Math.max(1, Number(request.query('limit') ?? 50)))
    const before = request.query('before')
    const after = request.query('after')

    let query = Message.query().where('room_id', roomId) as any

    if (before) query = query.where('id', '<', Number(before))
    if (after) query = query.where('id', '>', Number(after))

    const messages = await query.orderBy('id', 'desc').limit(limit).get() as any[]

    const data = await Promise.all(messages.reverse().map(async (m: any) => {
      const senderId = m.getAttribute('user_id') as number
      const sender = await User.find(senderId)
      return {
        ...m.toObject(),
        sender: sender ? { id: sender.getAttribute('id'), name: sender.getAttribute('name') } : null,
      }
    }))

    return MantiqResponse.json({
      data,
      has_more: messages.length === limit,
    })
  }

  async send(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))
    if (!(await isMember(userId, roomId))) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)
    }

    const body = await request.input() as { body?: string; type?: string; reply_to_id?: number }
    if (!body.body?.trim()) {
      return MantiqResponse.json({ error: 'Message body is required.' }, 422)
    }

    const validTypes = ['text', 'image', 'file', 'system']
    const msgType = body.type ?? 'text'
    if (!validTypes.includes(msgType)) {
      return MantiqResponse.json({ error: `Invalid message type. Must be: ${validTypes.join(', ')}` }, 422)
    }

    if (body.reply_to_id) {
      const parent = await Message.find(body.reply_to_id)
      if (!parent || parent.getAttribute('room_id') !== roomId) {
        return MantiqResponse.json({ error: 'Reply target message not found in this room.' }, 422)
      }
    }

    const message = await Message.create({
      room_id: roomId,
      user_id: userId,
      body: body.body.trim(),
      type: msgType,
      reply_to_id: body.reply_to_id ?? null,
      edited_at: null,
    })

    const sender = await User.find(userId)
    return MantiqResponse.json({
      data: {
        ...message.toObject(),
        sender: sender ? { id: sender.getAttribute('id'), name: sender.getAttribute('name') } : null,
      },
    }, 201)
  }

  async edit(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const message = await Message.find(id)
    if (!message) return MantiqResponse.json({ error: 'Message not found.' }, 404)
    if (message.getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'You can only edit your own messages.' }, 403)
    }

    const body = await request.input() as { body?: string }
    if (!body.body?.trim()) {
      return MantiqResponse.json({ error: 'Message body is required.' }, 422)
    }

    message.setAttribute('body', body.body.trim())
    message.setAttribute('edited_at', new Date().toISOString())
    await message.save()

    return MantiqResponse.json({ data: message.toObject() })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const message = await Message.find(id)
    if (!message) return MantiqResponse.json({ error: 'Message not found.' }, 404)

    const roomId = message.getAttribute('room_id') as number
    const member = await RoomMember.query().where('room_id', roomId).where('user_id', userId).first() as any

    if (message.getAttribute('user_id') !== userId) {
      const role = member?.getAttribute('role')
      if (role !== 'admin' && role !== 'owner') {
        return MantiqResponse.json({ error: 'You can only delete your own messages.' }, 403)
      }
    }

    await message.delete()
    return MantiqResponse.json({ message: 'Message deleted.' })
  }

  async search(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))
    if (!(await isMember(userId, roomId))) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)
    }

    const q = request.query('q')
    if (!q) return MantiqResponse.json({ error: 'Search query "q" is required.' }, 422)

    const messages = await (Message.query().where('room_id', roomId).where('body', 'LIKE', `%${q}%`) as any)
      .orderBy('id', 'desc').limit(50).get() as any[]

    return MantiqResponse.json({ data: messages.map((m: any) => m.toObject()), total: messages.length })
  }
}
