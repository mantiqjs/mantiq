import { describe, it, expect } from 'bun:test'
import { parseChannelName } from '../../src/contracts/Channel.ts'

describe('parseChannelName', () => {
  it('parses public channel', () => {
    expect(parseChannelName('chat.1')).toEqual({ type: 'public', baseName: 'chat.1' })
  })

  it('parses private channel', () => {
    expect(parseChannelName('private:orders.5')).toEqual({ type: 'private', baseName: 'orders.5' })
  })

  it('parses presence channel', () => {
    expect(parseChannelName('presence:room.3')).toEqual({ type: 'presence', baseName: 'room.3' })
  })

  it('treats unprefixed channels as public', () => {
    expect(parseChannelName('news')).toEqual({ type: 'public', baseName: 'news' })
  })

  it('handles channels with dots', () => {
    expect(parseChannelName('private:org.team.chat')).toEqual({
      type: 'private',
      baseName: 'org.team.chat',
    })
  })
})
