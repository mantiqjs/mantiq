import { describe, it, expect } from 'bun:test'
import { shouldSample } from '../../src/helpers/sampling.ts'
import type { HeartbeatConfig } from '../../src/contracts/HeartbeatConfig.ts'
import { DEFAULT_CONFIG } from '../../src/contracts/HeartbeatConfig.ts'

function config(overrides: Partial<HeartbeatConfig> = {}): HeartbeatConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}

describe('shouldSample', () => {
  it('returns false when disabled', () => {
    expect(shouldSample(config({ enabled: false }))).toBe(false)
  })

  it('returns true at rate 1.0', () => {
    expect(shouldSample(config())).toBe(true)
  })

  it('returns false at rate 0', () => {
    expect(shouldSample(config({ sampling: { rate: 0, always_sample_errors: false } }))).toBe(false)
  })

  it('always samples errors when always_sample_errors is true', () => {
    const cfg = config({ sampling: { rate: 0, always_sample_errors: true } })
    expect(shouldSample(cfg, true)).toBe(true)
  })

  it('does not always sample errors when always_sample_errors is false', () => {
    const cfg = config({ sampling: { rate: 0, always_sample_errors: false } })
    expect(shouldSample(cfg, true)).toBe(false)
  })
})
