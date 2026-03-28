import type { AIMiddleware, AIRequest, AINextFunction } from './AIMiddleware.ts'
import type { ChatResponse } from '../contracts/ChatMessage.ts'
import { AIError } from '../errors/AIError.ts'

export interface ContentModerationOptions {
  /** Custom patterns to block (regex). */
  blockedPatterns?: RegExp[]
  /** Maximum message length allowed. */
  maxLength?: number
  /** Action when content is flagged: 'block' throws, 'warn' logs and continues. */
  action?: 'block' | 'warn'
  /** Callback when content is flagged. */
  onFlagged?: (reason: string, content: string) => void
}

/**
 * Pre-flight content moderation — checks user messages before sending to AI.
 */
export class ContentModerationMiddleware implements AIMiddleware {
  private blockedPatterns: RegExp[]
  private maxLength: number
  private action: 'block' | 'warn'
  private onFlagged: ((reason: string, content: string) => void) | undefined

  constructor(options?: ContentModerationOptions) {
    this.blockedPatterns = options?.blockedPatterns ?? []
    this.maxLength = options?.maxLength ?? Infinity
    this.action = options?.action ?? 'block'
    this.onFlagged = options?.onFlagged ?? undefined
  }

  async handle(request: AIRequest, next: AINextFunction): Promise<ChatResponse> {
    for (const msg of request.messages) {
      if (msg.role !== 'user') continue
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content.filter((p) => p.type === 'text').map((p) => (p as any).text).join(' ')

      // Check length
      if (text.length > this.maxLength) {
        this.flag(`Content exceeds maximum length (${text.length}/${this.maxLength})`, text)
      }

      // Check blocked patterns
      for (const pattern of this.blockedPatterns) {
        if (pattern.test(text)) {
          this.flag(`Content matches blocked pattern: ${pattern.source}`, text)
        }
      }
    }

    return next(request)
  }

  private flag(reason: string, content: string): void {
    this.onFlagged?.(reason, content)
    if (this.action === 'block') {
      throw new AIError(`Content moderation: ${reason}`)
    } else {
      console.warn(`[Mantiq AI] Content moderation warning: ${reason}`)
    }
  }
}
