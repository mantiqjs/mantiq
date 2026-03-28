import { describe, it, expect } from 'bun:test'
import { estimateCost, MODEL_PRICING } from '../../src/helpers/cost.ts'

describe('estimateCost', () => {
  it('calculates cost for known models', () => {
    const cost = estimateCost('gpt-4o', { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 })
    // gpt-4o: 0.0025/1k prompt + 0.01/1k completion = 0.0125
    expect(cost).toBeCloseTo(0.0125)
  })

  it('calculates cost for gpt-4o-mini', () => {
    const cost = estimateCost('gpt-4o-mini', { promptTokens: 10000, completionTokens: 5000, totalTokens: 15000 })
    // 10 * 0.00015 + 5 * 0.0006 = 0.0015 + 0.003 = 0.0045
    expect(cost).toBeCloseTo(0.0045)
  })

  it('returns 0 for unknown models', () => {
    const cost = estimateCost('unknown-model', { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 })
    expect(cost).toBe(0)
  })

  it('matches by prefix', () => {
    const cost = estimateCost('gpt-4o-2024-08-06', { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 })
    expect(cost).toBeGreaterThan(0) // matches 'gpt-4o' prefix
  })

  it('uses custom pricing', () => {
    const cost = estimateCost(
      'custom-model',
      { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 },
      { 'custom-model': { promptPer1k: 0.1, completionPer1k: 0.2 } },
    )
    expect(cost).toBeCloseTo(0.3)
  })

  it('handles zero tokens', () => {
    const cost = estimateCost('gpt-4o', { promptTokens: 0, completionTokens: 0, totalTokens: 0 })
    expect(cost).toBe(0)
  })

  it('pricing table includes major models', () => {
    expect(MODEL_PRICING['gpt-4o']).toBeDefined()
    expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined()
    expect(MODEL_PRICING['claude-opus-4']).toBeDefined()
    expect(MODEL_PRICING['claude-sonnet-4']).toBeDefined()
    expect(MODEL_PRICING['gemini-2.0-flash']).toBeDefined()
    expect(MODEL_PRICING['text-embedding-3-small']).toBeDefined()
  })
})
