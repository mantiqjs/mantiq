import type { TokenUsage } from '../contracts/ChatMessage.ts'
import type { ModelPricing } from '../contracts/AIConfig.ts'

/**
 * Known model pricing (USD per 1K tokens).
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o': { promptPer1k: 0.0025, completionPer1k: 0.01 },
  'gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },
  'gpt-4-turbo': { promptPer1k: 0.01, completionPer1k: 0.03 },
  'gpt-4': { promptPer1k: 0.03, completionPer1k: 0.06 },
  'gpt-3.5-turbo': { promptPer1k: 0.0005, completionPer1k: 0.0015 },
  'o1': { promptPer1k: 0.015, completionPer1k: 0.06 },
  'o1-mini': { promptPer1k: 0.003, completionPer1k: 0.012 },
  // Anthropic
  'claude-opus-4': { promptPer1k: 0.015, completionPer1k: 0.075 },
  'claude-sonnet-4': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-haiku-4': { promptPer1k: 0.0008, completionPer1k: 0.004 },
  // Google
  'gemini-2.0-flash': { promptPer1k: 0.0001, completionPer1k: 0.0004 },
  'gemini-1.5-pro': { promptPer1k: 0.00125, completionPer1k: 0.005 },
  'gemini-1.5-flash': { promptPer1k: 0.000075, completionPer1k: 0.0003 },
  // Embeddings
  'text-embedding-3-small': { promptPer1k: 0.00002, completionPer1k: 0 },
  'text-embedding-3-large': { promptPer1k: 0.00013, completionPer1k: 0 },
  // Image
  'dall-e-3': { promptPer1k: 0.04, completionPer1k: 0 },
  // Audio
  'whisper-1': { promptPer1k: 0.006, completionPer1k: 0 },
  'tts-1': { promptPer1k: 0.015, completionPer1k: 0 },
  'tts-1-hd': { promptPer1k: 0.03, completionPer1k: 0 },
}

/**
 * Estimate cost for a given model and token usage.
 */
export function estimateCost(model: string, usage: TokenUsage, customPricing?: Record<string, ModelPricing>): number {
  const pricing = customPricing ?? MODEL_PRICING
  const price = pricing[model] ?? findPricingByPrefix(model, pricing)
  if (!price) return 0

  return (
    (usage.promptTokens / 1000) * price.promptPer1k +
    (usage.completionTokens / 1000) * price.completionPer1k
  )
}

function findPricingByPrefix(model: string, pricing: Record<string, ModelPricing>): ModelPricing | undefined {
  for (const [key, value] of Object.entries(pricing)) {
    if (model.startsWith(key)) return value
  }
  return undefined
}
