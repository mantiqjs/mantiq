import type { AIMiddleware, AIRequest, AINextFunction } from './AIMiddleware.ts'
import type { ChatResponse } from '../contracts/ChatMessage.ts'

export interface PIIRedactionOptions {
  /** Which PII types to redact. Defaults to all. */
  types?: PIIType[]
  /** Replacement string. Defaults to '[REDACTED]'. */
  replacement?: string
  /** Custom patterns to redact. */
  customPatterns?: { name: string; pattern: RegExp }[]
}

export type PIIType = 'email' | 'phone' | 'ssn' | 'creditCard' | 'ipAddress'

/**
 * Redacts PII (Personally Identifiable Information) from user messages
 * before they are sent to AI providers.
 */
export class PIIRedactionMiddleware implements AIMiddleware {
  private patterns: { name: string; pattern: RegExp }[]
  private replacement: string

  constructor(options?: PIIRedactionOptions) {
    this.replacement = options?.replacement ?? '[REDACTED]'

    const types = options?.types ?? ['email', 'phone', 'ssn', 'creditCard', 'ipAddress']
    this.patterns = types
      .map((type) => PII_PATTERNS[type])
      .filter((p): p is { name: string; pattern: RegExp } => !!p)

    if (options?.customPatterns) {
      this.patterns.push(...options.customPatterns)
    }
  }

  async handle(request: AIRequest, next: AINextFunction): Promise<ChatResponse> {
    const redacted: AIRequest = {
      ...request,
      messages: request.messages.map((msg) => {
        if (msg.role !== 'user') return msg
        if (typeof msg.content === 'string') {
          return { ...msg, content: this.redact(msg.content) }
        }
        return {
          ...msg,
          content: msg.content.map((part) =>
            part.type === 'text' ? { ...part, text: this.redact(part.text) } : part
          ),
        }
      }),
    }

    return next(redacted)
  }

  redact(text: string): string {
    let result = text
    for (const { pattern } of this.patterns) {
      result = result.replace(pattern, this.replacement)
    }
    return result
  }
}

const PII_PATTERNS: Record<PIIType, { name: string; pattern: RegExp }> = {
  email: {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
  phone: {
    name: 'phone',
    pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  },
  ssn: {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  creditCard: {
    name: 'creditCard',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  },
  ipAddress: {
    name: 'ipAddress',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  },
}
