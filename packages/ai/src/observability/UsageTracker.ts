import type { TokenUsage } from '../contracts/ChatMessage.ts'

export interface UsageRecord {
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  latencyMs: number
  timestamp: Date
}

export interface UsageReport {
  totalTokens: number
  totalCost: number
  requestCount: number
  avgLatencyMs: number
  byModel: Record<string, { tokens: number; cost: number; count: number }>
  byProvider: Record<string, { tokens: number; cost: number; count: number }>
}

/**
 * Tracks AI usage — tokens, cost, latency — across all providers.
 */
export class UsageTracker {
  private records: UsageRecord[] = []

  /** Record a usage entry. */
  record(entry: UsageRecord): void {
    this.records.push(entry)
  }

  /** Record from a response + timing. */
  recordFromResponse(data: {
    provider: string
    model: string
    usage: TokenUsage
    latencyMs: number
    cost?: number
  }): void {
    this.records.push({
      provider: data.provider,
      model: data.model,
      promptTokens: data.usage.promptTokens,
      completionTokens: data.usage.completionTokens,
      totalTokens: data.usage.totalTokens,
      estimatedCost: data.cost ?? 0,
      latencyMs: data.latencyMs,
      timestamp: new Date(),
    })
  }

  /** Get total cost since a date. */
  totalCost(since?: Date): number {
    return this.filter(since).reduce((sum, r) => sum + r.estimatedCost, 0)
  }

  /** Get total tokens since a date. */
  totalTokens(since?: Date): number {
    return this.filter(since).reduce((sum, r) => sum + r.totalTokens, 0)
  }

  /** Get records filtered by provider. */
  byProvider(provider: string): UsageRecord[] {
    return this.records.filter((r) => r.provider === provider)
  }

  /** Get records filtered by model. */
  byModel(model: string): UsageRecord[] {
    return this.records.filter((r) => r.model === model)
  }

  /** Generate a usage report. */
  report(options?: { since?: Date }): UsageReport {
    const filtered = this.filter(options?.since)

    const byModel: UsageReport['byModel'] = {}
    const byProvider: UsageReport['byProvider'] = {}

    for (const r of filtered) {
      // By model
      if (!byModel[r.model]) byModel[r.model] = { tokens: 0, cost: 0, count: 0 }
      byModel[r.model]!.tokens += r.totalTokens
      byModel[r.model]!.cost += r.estimatedCost
      byModel[r.model]!.count++

      // By provider
      if (!byProvider[r.provider]) byProvider[r.provider] = { tokens: 0, cost: 0, count: 0 }
      byProvider[r.provider]!.tokens += r.totalTokens
      byProvider[r.provider]!.cost += r.estimatedCost
      byProvider[r.provider]!.count++
    }

    return {
      totalTokens: filtered.reduce((s, r) => s + r.totalTokens, 0),
      totalCost: filtered.reduce((s, r) => s + r.estimatedCost, 0),
      requestCount: filtered.length,
      avgLatencyMs: filtered.length > 0
        ? filtered.reduce((s, r) => s + r.latencyMs, 0) / filtered.length
        : 0,
      byModel,
      byProvider,
    }
  }

  /** Get all records. */
  getRecords(): UsageRecord[] {
    return [...this.records]
  }

  /** Clear all records. */
  flush(): void {
    this.records = []
  }

  private filter(since?: Date): UsageRecord[] {
    if (!since) return this.records
    return this.records.filter((r) => r.timestamp >= since)
  }
}
