import type { ChatMessage } from '../contracts/ChatMessage.ts'

/**
 * Memory contract for agent conversation history.
 */
export interface Memory {
  add(message: ChatMessage): void
  getMessages(): ChatMessage[]
  clear(): void
}

/** Keep all messages in memory (unbounded). */
export class BufferMemory implements Memory {
  private messages: ChatMessage[] = []

  add(message: ChatMessage): void {
    this.messages.push(message)
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  clear(): void {
    this.messages = []
  }
}

/** Keep only the last N messages (sliding window). */
export class WindowMemory implements Memory {
  private messages: ChatMessage[] = []

  constructor(private windowSize: number = 20) {}

  add(message: ChatMessage): void {
    this.messages.push(message)
    if (this.messages.length > this.windowSize) {
      this.messages = this.messages.slice(-this.windowSize)
    }
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  clear(): void {
    this.messages = []
  }
}

/** Keep a summary of older messages, full text of recent ones. */
export class SummaryMemory implements Memory {
  private messages: ChatMessage[] = []
  private summary = ''

  constructor(
    private recentCount: number = 10,
    private summarizer?: (messages: ChatMessage[]) => Promise<string>,
  ) {}

  add(message: ChatMessage): void {
    this.messages.push(message)
  }

  getMessages(): ChatMessage[] {
    const recent = this.messages.slice(-this.recentCount)
    if (this.summary) {
      return [
        { role: 'system', content: `Previous conversation summary: ${this.summary}` },
        ...recent,
      ]
    }
    return [...recent]
  }

  /** Compress older messages into a summary. */
  async compress(): Promise<void> {
    if (this.messages.length <= this.recentCount) return

    const toSummarize = this.messages.slice(0, -this.recentCount)
    if (this.summarizer) {
      this.summary = await this.summarizer(toSummarize)
    } else {
      this.summary = toSummarize
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : '[multimodal]'}`)
        .join('\n')
    }

    this.messages = this.messages.slice(-this.recentCount)
  }

  clear(): void {
    this.messages = []
    this.summary = ''
  }
}
