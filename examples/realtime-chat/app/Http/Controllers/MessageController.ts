import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Message } from '../../Models/Message.ts'
import { RoomMember } from '../../Models/RoomMember.ts'
import { User } from '../../Models/User.ts'
import { Reaction } from '../../Models/Reaction.ts'

async function getAuthUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user()
  if (!user) return null
  return (user as any).getAttribute?.('id') ?? user.getAuthIdentifier()
}

export class MessageController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))

    // Check membership
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first()
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 403)

    const limit = Math.min(100, Math.max(1, Number(request.query('limit') ?? 50)))
    const cursor = request.query('cursor') // message id to paginate before
    const after = request.query('after') // message id to get messages after (for polling)

    let query = Message.query().where('room_id', roomId)

    if (after) {
      query = query.where('id', '>', Number(after)) as any
      const messages = await query.orderBy('id', 'asc').limit(limit).get() as any[]
      const data = await this.enrichMessages(messages)
      return MantiqResponse.json({ data, has_more: false })
    }

    if (cursor) {
      query = query.where('id', '<', Number(cursor)) as any
    }

    const messages = await query.orderBy('id', 'desc').limit(limit).get() as any[]
    messages.reverse() // Chronological order

    const data = await this.enrichMessages(messages)
    const hasMore = messages.length === limit

    return MantiqResponse.json({
      data,
      has_more: hasMore,
      next_cursor: messages.length > 0 ? (messages[0] as any).getAttribute('id') : null,
    })
  }

  async send(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))

    // Check membership
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first()
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 403)

    const body = await request.input() as { body?: string; type?: string; reply_to_id?: number }

    if (!body.body || !body.body.trim()) {
      return MantiqResponse.json({ error: 'Message body is required.' }, 422)
    }

    const message = await Message.create({
      room_id: roomId,
      user_id: userId,
      body: body.body.trim(),
      type: body.type ?? 'text',
      reply_to_id: body.reply_to_id ?? null,
    })

    const user = await User.find(userId)
    const msgData = {
      ...message.toObject(),
      user: user ? user.toObject() : null,
      reactions: [],
    }

    return MantiqResponse.json({ data: msgData }, 201)
  }

  async edit(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const messageId = Number(request.param('messageId'))
    const message = await Message.find(messageId)
    if (!message) return MantiqResponse.json({ error: 'Message not found.' }, 404)

    if ((message as any).getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'You can only edit your own messages.' }, 403)
    }

    const body = await request.input() as { body?: string }
    if (!body.body || !body.body.trim()) {
      return MantiqResponse.json({ error: 'Message body is required.' }, 422)
    }

    message.setAttribute('body', body.body.trim())
    message.setAttribute('edited_at', new Date().toISOString())
    await message.save()

    return MantiqResponse.json({ data: message.toObject() })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const messageId = Number(request.param('messageId'))
    const message = await Message.find(messageId)
    if (!message) return MantiqResponse.json({ error: 'Message not found.' }, 404)

    if ((message as any).getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'You can only delete your own messages.' }, 403)
    }

    await message.delete()
    return MantiqResponse.json({ success: true })
  }

  async search(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))
    const q = request.query('q') ?? ''

    if (!q.trim()) {
      return MantiqResponse.json({ data: [] })
    }

    // Check membership
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first()
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 403)

    const messages = await Message.query()
      .where('room_id', roomId)
      .where('body', 'LIKE', `%${q}%`)
      .orderBy('id', 'desc')
      .limit(20)
      .get() as any[]

    const data = await this.enrichMessages(messages)
    return MantiqResponse.json({ data })
  }

  private async enrichMessages(messages: any[]): Promise<any[]> {
    const data: any[] = []
    for (const m of messages) {
      const user = await User.find(m.getAttribute('user_id') as number)
      const reactions = await Reaction.where('message_id', m.getAttribute('id') as number).get() as any[]

      const reactionData: any[] = []
      for (const r of reactions) {
        const rUser = await User.find(r.getAttribute('user_id') as number)
        reactionData.push({
          ...r.toObject(),
          user: rUser ? rUser.toObject() : null,
        })
      }

      data.push({
        ...m.toObject(),
        user: user ? user.toObject() : null,
        reactions: reactionData,
      })
    }
    return data
  }
}
