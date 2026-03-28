import type { ChatMessage, ChatOptions, ChatResponse } from '../contracts/ChatMessage.ts'

export interface AIRequest {
  messages: ChatMessage[]
  options: ChatOptions
  provider: string
  metadata: Record<string, any>
}

export type AINextFunction = (request: AIRequest) => Promise<ChatResponse>

/**
 * AI middleware contract — wraps AI requests (not HTTP requests).
 */
export interface AIMiddleware {
  handle(request: AIRequest, next: AINextFunction): Promise<ChatResponse>
}
