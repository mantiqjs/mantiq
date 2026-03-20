import { describe, it, expect } from 'bun:test'
import { parseClientMessage, serialize } from '../../src/protocol/Protocol.ts'

describe('parseClientMessage', () => {
  it('parses subscribe message', () => {
    const msg = parseClientMessage(JSON.stringify({ event: 'subscribe', channel: 'chat.1' }))
    expect(msg).toEqual({ event: 'subscribe', channel: 'chat.1' })
  })

  it('parses unsubscribe message', () => {
    const msg = parseClientMessage(JSON.stringify({ event: 'unsubscribe', channel: 'chat.1' }))
    expect(msg).toEqual({ event: 'unsubscribe', channel: 'chat.1' })
  })

  it('parses whisper message', () => {
    const msg = parseClientMessage(JSON.stringify({
      event: 'whisper',
      channel: 'private:chat.1',
      type: 'typing',
      data: { user: 'alice' },
    }))
    expect(msg).toEqual({
      event: 'whisper',
      channel: 'private:chat.1',
      type: 'typing',
      data: { user: 'alice' },
    })
  })

  it('parses whisper message with missing data as empty object', () => {
    const msg = parseClientMessage(JSON.stringify({
      event: 'whisper',
      channel: 'private:chat.1',
      type: 'typing',
    }))
    expect(msg).toEqual({
      event: 'whisper',
      channel: 'private:chat.1',
      type: 'typing',
      data: {},
    })
  })

  it('parses ping message', () => {
    const msg = parseClientMessage(JSON.stringify({ event: 'ping' }))
    expect(msg).toEqual({ event: 'ping' })
  })

  it('returns null for invalid JSON', () => {
    expect(parseClientMessage('not json')).toBeNull()
  })

  it('returns null for non-object', () => {
    expect(parseClientMessage('"hello"')).toBeNull()
    expect(parseClientMessage('42')).toBeNull()
    expect(parseClientMessage('null')).toBeNull()
  })

  it('returns null for missing event field', () => {
    expect(parseClientMessage(JSON.stringify({ channel: 'test' }))).toBeNull()
  })

  it('returns null for unknown event type', () => {
    expect(parseClientMessage(JSON.stringify({ event: 'unknown' }))).toBeNull()
  })

  it('returns null for subscribe without channel', () => {
    expect(parseClientMessage(JSON.stringify({ event: 'subscribe' }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ event: 'subscribe', channel: '' }))).toBeNull()
  })

  it('returns null for whisper without type', () => {
    expect(parseClientMessage(JSON.stringify({ event: 'whisper', channel: 'private:x' }))).toBeNull()
  })

  it('handles Buffer input', () => {
    const buf = Buffer.from(JSON.stringify({ event: 'ping' }))
    expect(parseClientMessage(buf)).toEqual({ event: 'ping' })
  })
})

describe('serialize', () => {
  it('serializes server message to JSON', () => {
    const result = serialize({ event: 'subscribed', channel: 'chat.1' })
    expect(JSON.parse(result)).toEqual({ event: 'subscribed', channel: 'chat.1' })
  })

  it('serializes error message', () => {
    const result = serialize({ event: 'error', message: 'Not found' })
    expect(JSON.parse(result)).toEqual({ event: 'error', message: 'Not found' })
  })
})
