import { describe, test, expect } from 'bun:test'
import { Job } from '../../src/Job.ts'

class TestJob extends Job {
  constructor(
    public orderId: number,
    public amount: number,
  ) {
    super()
  }

  override async handle(): Promise<void> {}
}

class CustomBackoffJob extends Job {
  override backoff = '30,60,120'
  override async handle(): Promise<void> {}
}

class ExponentialJob extends Job {
  override backoff = 'exponential:10'
  override async handle(): Promise<void> {}
}

describe('Job', () => {
  test('serialize() captures user properties as data', () => {
    const job = new TestJob(42, 99.99)
    const payload = job.serialize()

    expect(payload.jobName).toBe('TestJob')
    expect(payload.data).toEqual({ orderId: 42, amount: 99.99 })
    expect(payload.queue).toBe('default')
    expect(payload.tries).toBe(3)
    expect(payload.timeout).toBe(60)
    expect(payload.delay).toBe(0)
    expect(payload.connection).toBeNull()
  })

  test('serialize() excludes base class keys from data', () => {
    const job = new TestJob(1, 2)
    job.queue = 'payments'
    job.tries = 5
    const payload = job.serialize()

    // Base keys should be in their top-level fields, NOT in data
    expect(payload.data).toEqual({ orderId: 1, amount: 2 })
    expect(payload.queue).toBe('payments')
    expect(payload.tries).toBe(5)
  })

  test('serialize() includes custom queue/connection/timeout', () => {
    const job = new TestJob(1, 2)
    job.queue = 'high'
    job.connection = 'redis'
    job.timeout = 120
    job.backoff = 'exponential:30'
    const payload = job.serialize()

    expect(payload.queue).toBe('high')
    expect(payload.connection).toBe('redis')
    expect(payload.timeout).toBe(120)
    expect(payload.backoff).toBe('exponential:30')
  })

  test('getBackoffDelay() returns 0 for no backoff', () => {
    const job = new TestJob(1, 2)
    expect(job.getBackoffDelay(1)).toBe(0)
  })

  test('getBackoffDelay() returns fixed delay', () => {
    const job = new TestJob(1, 2)
    job.backoff = '30'
    expect(job.getBackoffDelay(1)).toBe(30)
    expect(job.getBackoffDelay(2)).toBe(30)
    expect(job.getBackoffDelay(3)).toBe(30)
  })

  test('getBackoffDelay() handles comma-separated values', () => {
    const job = new CustomBackoffJob()
    expect(job.getBackoffDelay(1)).toBe(30)
    expect(job.getBackoffDelay(2)).toBe(60)
    expect(job.getBackoffDelay(3)).toBe(120)
    // Beyond the list: uses the last value
    expect(job.getBackoffDelay(4)).toBe(120)
  })

  test('getBackoffDelay() handles exponential backoff', () => {
    const job = new ExponentialJob()
    expect(job.getBackoffDelay(1)).toBe(10)   // 10 * 2^0
    expect(job.getBackoffDelay(2)).toBe(20)   // 10 * 2^1
    expect(job.getBackoffDelay(3)).toBe(40)   // 10 * 2^2
    expect(job.getBackoffDelay(4)).toBe(80)   // 10 * 2^3
  })

  test('default property values', () => {
    const job = new TestJob(1, 2)
    expect(job.queue).toBe('default')
    expect(job.connection).toBeNull()
    expect(job.tries).toBe(3)
    expect(job.backoff).toBe('0')
    expect(job.timeout).toBe(60)
    expect(job.delay).toBe(0)
    expect(job.attempts).toBe(0)
    expect(job.jobId).toBeNull()
  })
})
