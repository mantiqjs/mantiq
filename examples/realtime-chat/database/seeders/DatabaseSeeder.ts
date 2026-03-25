import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { Room } from '../../app/Models/Room.ts'
import { RoomMember } from '../../app/Models/RoomMember.ts'
import { Message } from '../../app/Models/Message.ts'
import { Reaction } from '../../app/Models/Reaction.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const existing = await User.where('email', 'alice@example.com').first()
    if (existing) return

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')
    const now = new Date().toISOString()

    // Users
    const alice = await User.create({ name: 'Alice', email: 'alice@example.com', password: hashed, avatar_url: null, status: 'online', last_seen_at: now })
    const bob = await User.create({ name: 'Bob', email: 'bob@example.com', password: hashed, avatar_url: null, status: 'online', last_seen_at: now })
    const charlie = await User.create({ name: 'Charlie', email: 'charlie@example.com', password: hashed, avatar_url: null, status: 'away', last_seen_at: now })
    const diana = await User.create({ name: 'Diana', email: 'diana@example.com', password: hashed, avatar_url: null, status: 'offline', last_seen_at: null })

    const aliceId = alice.getAttribute('id') as number
    const bobId = bob.getAttribute('id') as number
    const charlieId = charlie.getAttribute('id') as number
    const dianaId = diana.getAttribute('id') as number

    // Rooms
    const general = await Room.create({ name: 'General', description: 'General discussion', type: 'public', created_by: aliceId, max_members: 100 })
    const engineering = await Room.create({ name: 'Engineering', description: 'Engineering team chat', type: 'private', created_by: bobId, max_members: 50 })
    const dm = await Room.create({ name: 'Alice & Bob', description: null, type: 'direct', created_by: aliceId, max_members: 2 })

    const generalId = general.getAttribute('id') as number
    const engineeringId = engineering.getAttribute('id') as number
    const dmId = dm.getAttribute('id') as number

    // Memberships
    const members = [
      { room_id: generalId, user_id: aliceId, role: 'owner' },
      { room_id: generalId, user_id: bobId, role: 'admin' },
      { room_id: generalId, user_id: charlieId, role: 'member' },
      { room_id: generalId, user_id: dianaId, role: 'member' },
      { room_id: engineeringId, user_id: bobId, role: 'owner' },
      { room_id: engineeringId, user_id: aliceId, role: 'admin' },
      { room_id: engineeringId, user_id: charlieId, role: 'member' },
      { room_id: dmId, user_id: aliceId, role: 'member' },
      { room_id: dmId, user_id: bobId, role: 'member' },
    ]
    for (const m of members) {
      await RoomMember.create({ ...m, joined_at: now, muted: 0 })
    }

    // Messages
    const chatMessages = [
      { room_id: generalId, user_id: aliceId, body: 'Welcome everyone to the General channel!', type: 'system' },
      { room_id: generalId, user_id: bobId, body: 'Hey all! Great to be here.', type: 'text' },
      { room_id: generalId, user_id: charlieId, body: 'Hello! What are we working on today?', type: 'text' },
      { room_id: generalId, user_id: aliceId, body: 'We have a big release coming up next week. Let\'s coordinate.', type: 'text' },
      { room_id: generalId, user_id: dianaId, body: 'I\'ll handle the QA side. Any specific areas to focus on?', type: 'text' },
      { room_id: generalId, user_id: bobId, body: 'The auth module needs the most testing. We refactored session handling.', type: 'text' },
      { room_id: generalId, user_id: charlieId, body: 'I can help with performance testing.', type: 'text' },
      { room_id: generalId, user_id: aliceId, body: 'Perfect. Let\'s sync in the engineering channel for details.', type: 'text' },
      { room_id: engineeringId, user_id: bobId, body: 'Alright team, here\'s the plan for the auth refactor.', type: 'text' },
      { room_id: engineeringId, user_id: aliceId, body: 'I\'ve been looking at the session store. We should switch to Redis in production.', type: 'text' },
      { room_id: engineeringId, user_id: charlieId, body: 'Makes sense. What about the migration path for existing sessions?', type: 'text' },
      { room_id: engineeringId, user_id: bobId, body: 'We\'ll do a rolling migration. Old sessions expire naturally.', type: 'text' },
      { room_id: engineeringId, user_id: aliceId, body: 'Good approach. I\'ll draft the PR today.', type: 'text' },
      { room_id: engineeringId, user_id: charlieId, body: 'I\'ll set up the Redis benchmark tests.', type: 'text' },
      { room_id: engineeringId, user_id: bobId, body: 'Don\'t forget to update the config schema.', type: 'text' },
      { room_id: dmId, user_id: aliceId, body: 'Hey Bob, quick question about the deploy pipeline.', type: 'text' },
      { room_id: dmId, user_id: bobId, body: 'Sure, what\'s up?', type: 'text' },
      { room_id: dmId, user_id: aliceId, body: 'Should we add a canary stage before full rollout?', type: 'text' },
      { room_id: dmId, user_id: bobId, body: 'Absolutely. I\'ll add it to the pipeline config.', type: 'text' },
      { room_id: dmId, user_id: aliceId, body: 'Great, thanks!', type: 'text' },
      { room_id: generalId, user_id: dianaId, body: 'Just finished the test plan. Sharing it now.', type: 'text' },
      { room_id: generalId, user_id: aliceId, body: 'Awesome work Diana!', type: 'text' },
      { room_id: generalId, user_id: bobId, body: 'Let\'s review it in tomorrow\'s standup.', type: 'text' },
      { room_id: engineeringId, user_id: aliceId, body: 'PR is up: #142 — Redis session migration', type: 'text' },
      { room_id: engineeringId, user_id: bobId, body: 'Reviewing now. Looks clean so far.', type: 'text' },
      { room_id: generalId, user_id: charlieId, body: 'Benchmark results are in — 3x improvement with Redis sessions.', type: 'text' },
      { room_id: generalId, user_id: aliceId, body: 'Incredible! Nice work Charlie.', type: 'text' },
      { room_id: generalId, user_id: bobId, body: 'Let\'s ship it! 🚀', type: 'text' },
      { room_id: dmId, user_id: bobId, body: 'Pipeline updated. Canary stage runs for 15 minutes.', type: 'text' },
      { room_id: dmId, user_id: aliceId, body: 'Perfect. That should catch any issues.', type: 'text' },
    ]
    const messageRecords: any[] = []
    for (const m of chatMessages) {
      messageRecords.push(await Message.create({ ...m, reply_to_id: null, edited_at: null }))
    }

    // Reactions
    const reactions = [
      { message_id: messageRecords[1]!.getAttribute('id'), user_id: aliceId, emoji: '👋' },
      { message_id: messageRecords[3]!.getAttribute('id'), user_id: bobId, emoji: '👍' },
      { message_id: messageRecords[3]!.getAttribute('id'), user_id: charlieId, emoji: '🔥' },
      { message_id: messageRecords[7]!.getAttribute('id'), user_id: bobId, emoji: '✅' },
      { message_id: messageRecords[21]!.getAttribute('id'), user_id: bobId, emoji: '🎉' },
      { message_id: messageRecords[26]!.getAttribute('id'), user_id: bobId, emoji: '📊' },
      { message_id: messageRecords[27]!.getAttribute('id'), user_id: aliceId, emoji: '🚀' },
      { message_id: messageRecords[27]!.getAttribute('id'), user_id: charlieId, emoji: '🚀' },
    ]
    for (const r of reactions) {
      await Reaction.create(r)
    }
  }
}
