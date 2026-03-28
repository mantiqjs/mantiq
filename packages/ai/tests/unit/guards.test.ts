import { describe, it, expect } from 'bun:test'
import { ModelPolicy } from '../../src/guards/ModelPolicy.ts'
import { UsageQuota } from '../../src/guards/UsageQuota.ts'

describe('ModelPolicy', () => {
  it('allows models by default', () => {
    const policy = new ModelPolicy()
    expect(policy.can({}, 'gpt-4o')).toBe(true)
  })

  it('denies explicitly denied models', () => {
    const policy = new ModelPolicy()
    policy.deny('gpt-4-turbo')
    expect(policy.can({}, 'gpt-4-turbo')).toBe(false)
  })

  it('checks allow rules', () => {
    const policy = new ModelPolicy()
    policy.allow('gpt-4o', (user) => user.plan === 'pro')
    expect(policy.can({ plan: 'pro' }, 'gpt-4o')).toBe(true)
    expect(policy.can({ plan: 'free' }, 'gpt-4o')).toBe(false)
  })

  it('deny overrides allow', () => {
    const policy = new ModelPolicy()
    policy.allow('gpt-4o', () => true)
    policy.deny('gpt-4o')
    expect(policy.can({}, 'gpt-4o')).toBe(false)
  })

  it('allow overrides previous deny', () => {
    const policy = new ModelPolicy()
    policy.deny('gpt-4o')
    policy.allow('gpt-4o', () => true)
    expect(policy.can({}, 'gpt-4o')).toBe(true)
  })

  it('matches by prefix', () => {
    const policy = new ModelPolicy()
    policy.allow('gpt-4', (user) => user.plan === 'pro')
    expect(policy.can({ plan: 'pro' }, 'gpt-4o')).toBe(true)
    expect(policy.can({ plan: 'pro' }, 'gpt-4-turbo')).toBe(true)
    expect(policy.can({ plan: 'free' }, 'gpt-4o')).toBe(false)
  })

  it('respects setDefault(false)', () => {
    const policy = new ModelPolicy()
    policy.setDefault(false)
    expect(policy.can({}, 'unknown-model')).toBe(false)
  })

  it('lists rules', () => {
    const policy = new ModelPolicy()
    policy.allow('gpt-4o', () => true)
    policy.deny('gpt-3.5-turbo')
    const rules = policy.listRules()
    expect(rules).toHaveLength(2)
    expect(rules.find((r) => r.model === 'gpt-4o')?.type).toBe('allow')
    expect(rules.find((r) => r.model === 'gpt-3.5-turbo')?.type).toBe('deny')
  })
})

describe('UsageQuota', () => {
  it('allows when no limit set', () => {
    const quota = new UsageQuota()
    const check = quota.check('user:1', 'free')
    expect(check.allowed).toBe(true)
  })

  it('allows within limits', () => {
    const quota = new UsageQuota()
    quota.setLimit('free', { maxTokens: 1000, maxRequests: 10, period: 'day' })

    quota.record('user:1', 'free', { promptTokens: 50, completionTokens: 50, totalTokens: 100 })
    const check = quota.check('user:1', 'free')
    expect(check.allowed).toBe(true)
    expect(check.remaining.tokens).toBe(900)
    expect(check.remaining.requests).toBe(9)
  })

  it('denies when tokens exceeded', () => {
    const quota = new UsageQuota()
    quota.setLimit('free', { maxTokens: 100, period: 'day' })

    quota.record('user:1', 'free', { promptTokens: 50, completionTokens: 60, totalTokens: 110 })
    const check = quota.check('user:1', 'free')
    expect(check.allowed).toBe(false)
    expect(check.remaining.tokens).toBe(0)
  })

  it('denies when requests exceeded', () => {
    const quota = new UsageQuota()
    quota.setLimit('free', { maxRequests: 2, period: 'hour' })

    quota.record('user:1', 'free', { promptTokens: 10, completionTokens: 10, totalTokens: 20 })
    quota.record('user:1', 'free', { promptTokens: 10, completionTokens: 10, totalTokens: 20 })
    const check = quota.check('user:1', 'free')
    expect(check.allowed).toBe(false)
  })

  it('denies when cost exceeded', () => {
    const quota = new UsageQuota()
    quota.setLimit('free', { maxCost: 1.0, period: 'day' })

    quota.record('user:1', 'free', { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, 0.6)
    quota.record('user:1', 'free', { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, 0.5)
    const check = quota.check('user:1', 'free')
    expect(check.allowed).toBe(false)
    expect(check.remaining.cost).toBe(0)
  })

  it('isolates users', () => {
    const quota = new UsageQuota()
    quota.setLimit('free', { maxTokens: 100, period: 'day' })

    quota.record('user:1', 'free', { promptTokens: 50, completionTokens: 60, totalTokens: 110 })
    const check1 = quota.check('user:1', 'free')
    const check2 = quota.check('user:2', 'free')
    expect(check1.allowed).toBe(false)
    expect(check2.allowed).toBe(true)
  })

  it('resets a user bucket', () => {
    const quota = new UsageQuota()
    quota.setLimit('free', { maxTokens: 100, period: 'day' })
    quota.record('user:1', 'free', { promptTokens: 50, completionTokens: 60, totalTokens: 110 })
    expect(quota.check('user:1', 'free').allowed).toBe(false)

    quota.reset('user:1', 'free')
    expect(quota.check('user:1', 'free').allowed).toBe(true)
  })

  it('provides resetsAt in the future', () => {
    const quota = new UsageQuota()
    quota.setLimit('free', { maxTokens: 100, period: 'day' })
    quota.record('user:1', 'free', { promptTokens: 0, completionTokens: 0, totalTokens: 0 })
    const check = quota.check('user:1', 'free')
    expect(check.resetsAt.getTime()).toBeGreaterThan(Date.now())
  })
})
