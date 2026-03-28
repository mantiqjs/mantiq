import type { AIMiddleware, AIRequest, AINextFunction } from './AIMiddleware.ts'
import type { ChatResponse, TokenUsage } from '../contracts/ChatMessage.ts'
import type { ModelPricing } from '../contracts/AIConfig.ts'

/**
 * Tracks token usage and estimated cost for each AI request.
 */
export class CostTrackingMiddleware implements AIMiddleware {
  private pricing: Record<string, ModelPricing>
  private onCost: ((data: { model: string; usage: TokenUsage; cost: number }) => void) | undefined

  constructor(options?: {
    pricing?: Record<string, ModelPricing>
    onCost?: (data: { model: string; usage: TokenUsage; cost: number }) => void
  }) {
    this.pricing = options?.pricing ?? DEFAULT_PRICING
    this.onCost = options?.onCost ?? undefined
  }

  async handle(request: AIRequest, next: AINextFunction): Promise<ChatResponse> {
    const response = await next(request)
    const model = response.model ?? request.options.model ?? 'unknown'

    const cost = this.estimateCost(model, response.usage)
    this.onCost?.({ model, usage: response.usage, cost })

    return response
  }

  estimateCost(model: string, usage: TokenUsage): number {
    const price = this.findPricing(model)
    if (!price) return 0

    return (
      (usage.promptTokens / 1000) * price.promptPer1k +
      (usage.completionTokens / 1000) * price.completionPer1k
    )
  }

  private findPricing(model: string): ModelPricing | undefined {
    // Try exact match first, then prefix match
    if (this.pricing[model]) return this.pricing[model]
    for (const [key, value] of Object.entries(this.pricing)) {
      if (model.startsWith(key)) return value
    }
    return undefined
  }
}

/** Known model pricing (USD per 1K tokens). Updated as of 2025. */
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { promptPer1k: 0.0025, completionPer1k: 0.01 },
  'gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },
  'gpt-4-turbo': { promptPer1k: 0.01, completionPer1k: 0.03 },
  'gpt-4': { promptPer1k: 0.03, completionPer1k: 0.06 },
  'gpt-3.5-turbo': { promptPer1k: 0.0005, completionPer1k: 0.0015 },
  'claude-opus-4': { promptPer1k: 0.015, completionPer1k: 0.075 },
  'claude-sonnet-4': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-haiku-4': { promptPer1k: 0.0008, completionPer1k: 0.004 },
  'gemini-2.0-flash': { promptPer1k: 0.0001, completionPer1k: 0.0004 },
  'gemini-1.5-pro': { promptPer1k: 0.00125, completionPer1k: 0.005 },
}
