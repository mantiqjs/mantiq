import { describe, it, expect } from 'bun:test'
import { BufferMemory, WindowMemory, SummaryMemory } from '../../src/agents/Memory.ts'
import type { ChatMessage } from '../../src/contracts/ChatMessage.ts'

const msg = (role: ChatMessage['role'], content: string): ChatMessage => ({ role, content })

describe('BufferMemory', () => {
  it('stores all messages', () => {
    const memory = new BufferMemory()
    memory.add(msg('user', 'Hello'))
    memory.add(msg('assistant', 'Hi'))
    memory.add(msg('user', 'How are you?'))
    expect(memory.getMessages()).toHaveLength(3)
  })

  it('returns a copy', () => {
    const memory = new BufferMemory()
    memory.add(msg('user', 'Hello'))
    const messages = memory.getMessages()
    messages.push(msg('user', 'extra'))
    expect(memory.getMessages()).toHaveLength(1)
  })

  it('clears all messages', () => {
    const memory = new BufferMemory()
    memory.add(msg('user', 'Hello'))
    memory.clear()
    expect(memory.getMessages()).toHaveLength(0)
  })
})

describe('WindowMemory', () => {
  it('keeps only the last N messages', () => {
    const memory = new WindowMemory(3)
    memory.add(msg('user', '1'))
    memory.add(msg('assistant', '2'))
    memory.add(msg('user', '3'))
    memory.add(msg('assistant', '4'))
    memory.add(msg('user', '5'))

    const messages = memory.getMessages()
    expect(messages).toHaveLength(3)
    expect(messages[0]!.content).toBe('3')
    expect(messages[2]!.content).toBe('5')
  })

  it('works when under window size', () => {
    const memory = new WindowMemory(10)
    memory.add(msg('user', 'Hello'))
    expect(memory.getMessages()).toHaveLength(1)
  })
})

describe('SummaryMemory', () => {
  it('returns all messages when under recentCount', () => {
    const memory = new SummaryMemory(5)
    memory.add(msg('user', 'Hello'))
    memory.add(msg('assistant', 'Hi'))
    expect(memory.getMessages()).toHaveLength(2)
  })

  it('compresses older messages into summary', async () => {
    const memory = new SummaryMemory(2, async (msgs) => {
      return `Summary of ${msgs.length} messages`
    })

    memory.add(msg('user', '1'))
    memory.add(msg('assistant', '2'))
    memory.add(msg('user', '3'))
    memory.add(msg('assistant', '4'))

    await memory.compress()

    const messages = memory.getMessages()
    // Should have summary system message + 2 recent
    expect(messages[0]!.role).toBe('system')
    expect(messages[0]!.content).toContain('Summary of 2 messages')
    expect(messages).toHaveLength(3)
  })

  it('clears summary and messages', async () => {
    const memory = new SummaryMemory(2)
    memory.add(msg('user', '1'))
    memory.add(msg('assistant', '2'))
    memory.add(msg('user', '3'))
    await memory.compress()
    memory.clear()
    expect(memory.getMessages()).toHaveLength(0)
  })
})
