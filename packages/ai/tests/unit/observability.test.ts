import { describe, it, expect } from 'bun:test'
import { UsageTracker } from '../../src/observability/UsageTracker.ts'

describe('UsageTracker', () => {
  const makeRecord = (overrides: Partial<Parameters<UsageTracker['record']>[0]> = {}) => ({
    provider: 'openai',
    model: 'gpt-4o',
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    estimatedCost: 0.0075,
    latencyMs: 500,
    timestamp: new Date(),
    ...overrides,
  })

  it('records and retrieves entries', () => {
    const tracker = new UsageTracker()
    tracker.record(makeRecord())
    tracker.record(makeRecord({ model: 'gpt-4o-mini' }))
    expect(tracker.getRecords()).toHaveLength(2)
  })

  it('calculates total cost', () => {
    const tracker = new UsageTracker()
    tracker.record(makeRecord({ estimatedCost: 0.01 }))
    tracker.record(makeRecord({ estimatedCost: 0.02 }))
    expect(tracker.totalCost()).toBeCloseTo(0.03)
  })

  it('calculates total tokens', () => {
    const tracker = new UsageTracker()
    tracker.record(makeRecord({ totalTokens: 100 }))
    tracker.record(makeRecord({ totalTokens: 200 }))
    expect(tracker.totalTokens()).toBe(300)
  })

  it('filters by provider', () => {
    const tracker = new UsageTracker()
    tracker.record(makeRecord({ provider: 'openai' }))
    tracker.record(makeRecord({ provider: 'anthropic' }))
    tracker.record(makeRecord({ provider: 'openai' }))
    expect(tracker.byProvider('openai')).toHaveLength(2)
    expect(tracker.byProvider('anthropic')).toHaveLength(1)
  })

  it('filters by model', () => {
    const tracker = new UsageTracker()
    tracker.record(makeRecord({ model: 'gpt-4o' }))
    tracker.record(makeRecord({ model: 'gpt-4o-mini' }))
    tracker.record(makeRecord({ model: 'gpt-4o' }))
    expect(tracker.byModel('gpt-4o')).toHaveLength(2)
  })

  it('filters by date', () => {
    const tracker = new UsageTracker()
    const yesterday = new Date(Date.now() - 86400000)
    const now = new Date()
    tracker.record(makeRecord({ timestamp: yesterday, estimatedCost: 1 }))
    tracker.record(makeRecord({ timestamp: now, estimatedCost: 2 }))

    const recentCost = tracker.totalCost(new Date(Date.now() - 3600000))
    expect(recentCost).toBeCloseTo(2)
  })

  it('generates a report', () => {
    const tracker = new UsageTracker()
    tracker.record(makeRecord({ provider: 'openai', model: 'gpt-4o', totalTokens: 100, estimatedCost: 0.01, latencyMs: 200 }))
    tracker.record(makeRecord({ provider: 'openai', model: 'gpt-4o-mini', totalTokens: 50, estimatedCost: 0.005, latencyMs: 100 }))
    tracker.record(makeRecord({ provider: 'anthropic', model: 'claude-sonnet-4', totalTokens: 200, estimatedCost: 0.02, latencyMs: 300 }))

    const report = tracker.report()
    expect(report.requestCount).toBe(3)
    expect(report.totalTokens).toBe(350)
    expect(report.totalCost).toBeCloseTo(0.035)
    expect(report.avgLatencyMs).toBe(200)
    expect(Object.keys(report.byModel)).toHaveLength(3)
    expect(Object.keys(report.byProvider)).toHaveLength(2)
    expect(report.byProvider['openai']!.count).toBe(2)
  })

  it('flushes records', () => {
    const tracker = new UsageTracker()
    tracker.record(makeRecord())
    tracker.flush()
    expect(tracker.getRecords()).toHaveLength(0)
    expect(tracker.totalCost()).toBe(0)
  })

  it('recordFromResponse helper', () => {
    const tracker = new UsageTracker()
    tracker.recordFromResponse({
      provider: 'openai',
      model: 'gpt-4o',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 500,
      cost: 0.01,
    })
    expect(tracker.getRecords()).toHaveLength(1)
    expect(tracker.getRecords()[0]!.estimatedCost).toBe(0.01)
  })
})
