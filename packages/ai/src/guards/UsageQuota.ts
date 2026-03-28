import type { TokenUsage } from '../contracts/ChatMessage.ts'

export interface QuotaLimit {
  maxTokens?: number
  maxCost?: number
  maxRequests?: number
  period: 'hour' | 'day' | 'month'
}

export interface QuotaCheck {
  allowed: boolean
  remaining: {
    tokens?: number
    cost?: number
    requests?: number
  }
  resetsAt: Date
}

interface QuotaBucket {
  tokens: number
  cost: number
  requests: number
  periodStart: Date
}

/**
 * Per-user/team usage quotas for AI requests.
 *
 * @example
 *   const quota = new UsageQuota()
 *   quota.setLimit('free', { maxTokens: 100_000, maxRequests: 100, period: 'day' })
 *   quota.setLimit('pro', { maxTokens: 1_000_000, maxCost: 10, period: 'day' })
 *
 *   const check = quota.check('user:123', 'free')
 *   if (!check.allowed) throw new Error('Quota exceeded')
 *
 *   quota.record('user:123', 'free', usage, cost)
 */
export class UsageQuota {
  private limits = new Map<string, QuotaLimit>()
  private buckets = new Map<string, QuotaBucket>()

  /** Set a quota limit for a tier/plan. */
  setLimit(tier: string, limit: QuotaLimit): void {
    this.limits.set(tier, limit)
  }

  /** Check if a user is within their quota. */
  check(userId: string, tier: string): QuotaCheck {
    const limit = this.limits.get(tier)
    if (!limit) return { allowed: true, remaining: {}, resetsAt: new Date() }

    const key = `${userId}:${tier}`
    const bucket = this.getOrCreateBucket(key, limit)

    const allowed =
      (limit.maxTokens === undefined || bucket.tokens < limit.maxTokens) &&
      (limit.maxCost === undefined || bucket.cost < limit.maxCost) &&
      (limit.maxRequests === undefined || bucket.requests < limit.maxRequests)

    const remaining: QuotaCheck['remaining'] = {}
    if (limit.maxTokens !== undefined) remaining.tokens = Math.max(0, limit.maxTokens - bucket.tokens)
    if (limit.maxCost !== undefined) remaining.cost = Math.max(0, limit.maxCost - bucket.cost)
    if (limit.maxRequests !== undefined) remaining.requests = Math.max(0, limit.maxRequests - bucket.requests)

    return {
      allowed,
      remaining,
      resetsAt: this.getResetTime(bucket.periodStart, limit.period),
    }
  }

  /** Record usage against a user's quota. */
  record(userId: string, tier: string, usage: TokenUsage, cost: number = 0): void {
    const limit = this.limits.get(tier)
    if (!limit) return

    const key = `${userId}:${tier}`
    const bucket = this.getOrCreateBucket(key, limit)

    bucket.tokens += usage.totalTokens
    bucket.cost += cost
    bucket.requests++
  }

  /** Reset a user's usage bucket. */
  reset(userId: string, tier: string): void {
    this.buckets.delete(`${userId}:${tier}`)
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private getOrCreateBucket(key: string, limit: QuotaLimit): QuotaBucket {
    const existing = this.buckets.get(key)
    if (existing) {
      // Check if the period has elapsed
      const resetTime = this.getResetTime(existing.periodStart, limit.period)
      if (new Date() >= resetTime) {
        // Period expired — reset
        const bucket: QuotaBucket = { tokens: 0, cost: 0, requests: 0, periodStart: new Date() }
        this.buckets.set(key, bucket)
        return bucket
      }
      return existing
    }

    const bucket: QuotaBucket = { tokens: 0, cost: 0, requests: 0, periodStart: new Date() }
    this.buckets.set(key, bucket)
    return bucket
  }

  private getResetTime(periodStart: Date, period: 'hour' | 'day' | 'month'): Date {
    const reset = new Date(periodStart)
    switch (period) {
      case 'hour': reset.setHours(reset.getHours() + 1); break
      case 'day': reset.setDate(reset.getDate() + 1); break
      case 'month': reset.setMonth(reset.getMonth() + 1); break
    }
    return reset
  }
}
