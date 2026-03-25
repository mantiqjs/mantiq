import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { Room } from '../../app/Models/Room.ts'
import { RoomMember } from '../../app/Models/RoomMember.ts'
import { Message } from '../../app/Models/Message.ts'
import { Reaction } from '../../app/Models/Reaction.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')
    const now = new Date().toISOString()

    // ── Users ──────────────────────────────────────────────────────────────────
    const users = [
      { name: 'Alice Johnson', email: 'alice@example.com', avatar_url: null, status: 'online' },
      { name: 'Bob Smith', email: 'bob@example.com', avatar_url: null, status: 'online' },
      { name: 'Charlie Brown', email: 'charlie@example.com', avatar_url: null, status: 'away' },
      { name: 'Diana Prince', email: 'diana@example.com', avatar_url: null, status: 'offline' },
    ]

    const userIds: number[] = []
    for (const u of users) {
      const existing = await User.where('email', u.email).first()
      if (existing) {
        userIds.push((existing as any).getAttribute('id') as number)
        continue
      }
      const user = await User.create({ ...u, password: hashed })
      userIds.push((user as any).getAttribute('id') as number)
    }

    // ── Rooms ──────────────────────────────────────────────────────────────────
    const roomDefs = [
      { name: 'General', description: 'Open discussion for everyone', type: 'public', created_by: userIds[0]!, max_members: 100 },
      { name: 'Engineering', description: 'Tech discussions and code reviews', type: 'public', created_by: userIds[1]!, max_members: 50 },
      { name: 'Alice & Bob', description: null, type: 'direct', created_by: userIds[0]!, max_members: 2 },
    ]

    const roomIds: number[] = []
    for (const r of roomDefs) {
      const existing = await Room.where('name', r.name).first()
      if (existing) {
        roomIds.push((existing as any).getAttribute('id') as number)
        continue
      }
      const room = await Room.create(r)
      roomIds.push((room as any).getAttribute('id') as number)
    }

    // ── Room Members ───────────────────────────────────────────────────────────
    const memberships = [
      // General — everyone
      { room_id: roomIds[0]!, user_id: userIds[0]!, role: 'admin', joined_at: now, muted: 0 },
      { room_id: roomIds[0]!, user_id: userIds[1]!, role: 'member', joined_at: now, muted: 0 },
      { room_id: roomIds[0]!, user_id: userIds[2]!, role: 'member', joined_at: now, muted: 0 },
      { room_id: roomIds[0]!, user_id: userIds[3]!, role: 'member', joined_at: now, muted: 0 },
      // Engineering — Alice, Bob, Charlie
      { room_id: roomIds[1]!, user_id: userIds[0]!, role: 'admin', joined_at: now, muted: 0 },
      { room_id: roomIds[1]!, user_id: userIds[1]!, role: 'member', joined_at: now, muted: 0 },
      { room_id: roomIds[1]!, user_id: userIds[2]!, role: 'member', joined_at: now, muted: 0 },
      // DM — Alice & Bob
      { room_id: roomIds[2]!, user_id: userIds[0]!, role: 'member', joined_at: now, muted: 0 },
      { room_id: roomIds[2]!, user_id: userIds[1]!, role: 'member', joined_at: now, muted: 0 },
    ]

    for (const m of memberships) {
      const existing = await RoomMember.where('room_id', m.room_id).where('user_id', m.user_id).first()
      if (!existing) {
        await RoomMember.create(m)
      }
    }

    // ── Messages ───────────────────────────────────────────────────────────────
    const existingMessages = await Message.query().get() as any[]
    if (existingMessages.length > 0) return // Already seeded

    const conversations = [
      // General room
      { room_id: roomIds[0]!, user_id: userIds[0]!, body: 'Welcome to the General channel! Feel free to discuss anything here.', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[1]!, body: 'Hey everyone! Glad to be here.', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[2]!, body: 'What is everyone working on today?', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[3]!, body: 'I am reviewing the new design proposals. They look amazing!', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[0]!, body: 'Nice! I have been working on the real-time chat feature.', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[1]!, body: 'The new API endpoints are ready for testing.', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[2]!, body: 'Great progress team! Let us sync up after lunch.', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[3]!, body: 'Sounds good. I will prepare the presentation slides.', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[0]!, body: 'Perfect. Looking forward to it!', type: 'text' },
      { room_id: roomIds[0]!, user_id: userIds[1]!, body: 'Anyone up for a coffee break?', type: 'text' },

      // Engineering room
      { room_id: roomIds[1]!, user_id: userIds[0]!, body: 'We need to refactor the authentication module. Current approach has some issues.', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[1]!, body: 'Agreed. I think we should move to JWT tokens for the API layer.', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[2]!, body: 'What about session-based auth for the web frontend?', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[0]!, body: 'Yes, we can use a hybrid approach. Sessions for web, JWT for API.', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[1]!, body: 'I have drafted a PR for the database migration changes. PR #142', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[2]!, body: 'Reviewing it now. The schema looks clean.', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[0]!, body: 'Make sure we add proper indexes for the query performance.', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[1]!, body: 'Already done! Check line 45-52 in the migration file.', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[2]!, body: 'LGTM. Approving the PR now.', type: 'text' },
      { room_id: roomIds[1]!, user_id: userIds[0]!, body: 'Awesome teamwork! Merging it in.', type: 'text' },

      // DM — Alice & Bob
      { room_id: roomIds[2]!, user_id: userIds[0]!, body: 'Hey Bob, did you see the new requirements from the client?', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[1]!, body: 'Yes! They want real-time notifications too.', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[0]!, body: 'We can use WebSockets for that. Mantiq has built-in support.', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[1]!, body: 'Nice. I will set up the event broadcasting.', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[0]!, body: 'Perfect. Let us pair program on it tomorrow?', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[1]!, body: 'Sounds like a plan!', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[0]!, body: 'Great. See you at 10 AM then.', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[1]!, body: 'See you then!', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[0]!, body: 'By the way, the demo went really well today.', type: 'text' },
      { room_id: roomIds[2]!, user_id: userIds[1]!, body: 'Yeah, the client was impressed with the progress!', type: 'text' },
    ]

    const messageIds: number[] = []
    for (const msg of conversations) {
      const m = await Message.create(msg)
      messageIds.push((m as any).getAttribute('id') as number)
    }

    // ── Reactions ──────────────────────────────────────────────────────────────
    const reactions = [
      { message_id: messageIds[0]!, user_id: userIds[1]!, emoji: '\u{1F44D}' },
      { message_id: messageIds[0]!, user_id: userIds[2]!, emoji: '\u{1F389}' },
      { message_id: messageIds[1]!, user_id: userIds[0]!, emoji: '\u{1F44B}' },
      { message_id: messageIds[4]!, user_id: userIds[1]!, emoji: '\u{1F680}' },
      { message_id: messageIds[4]!, user_id: userIds[3]!, emoji: '\u{1F525}' },
      { message_id: messageIds[8]!, user_id: userIds[1]!, emoji: '\u{1F64C}' },
      { message_id: messageIds[10]!, user_id: userIds[1]!, emoji: '\u{1F4AA}' },
      { message_id: messageIds[14]!, user_id: userIds[0]!, emoji: '\u{1F440}' },
      { message_id: messageIds[19]!, user_id: userIds[2]!, emoji: '\u{1F389}' },
      { message_id: messageIds[25]!, user_id: userIds[0]!, emoji: '\u{1F44D}' },
    ]

    for (const r of reactions) {
      await Reaction.create(r)
    }
  }
}
