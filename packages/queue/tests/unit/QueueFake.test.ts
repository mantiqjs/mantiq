import { describe, test, expect, beforeEach } from 'bun:test'
import { QueueFake } from '../../src/testing/QueueFake.ts'
import { Job } from '../../src/Job.ts'
import type { SerializedPayload } from '../../src/contracts/JobContract.ts'

class ProcessPayment extends Job {
  constructor(public orderId: number) { super() }
  override async handle(): Promise<void> {}
}

class SendEmail extends Job {
  constructor(public to: string) { super() }
  override async handle(): Promise<void> {}
}

class NeverPushed extends Job {
  override async handle(): Promise<void> {}
}

function makePayload(jobName: string, overrides?: Partial<SerializedPayload>): SerializedPayload {
  return {
    jobName,
    data: {},
    queue: 'default',
    connection: null,
    tries: 3,
    backoff: '0',
    timeout: 60,
    delay: 0,
    ...overrides,
  }
}

describe('QueueFake', () => {
  let fake: QueueFake

  beforeEach(() => {
    fake = new QueueFake()
  })

  test('assertPushed() passes when job was pushed', async () => {
    await fake.push(makePayload('ProcessPayment'), 'default')
    expect(() => fake.assertPushed(ProcessPayment)).not.toThrow()
  })

  test('assertPushed() fails when job was not pushed', () => {
    expect(() => fake.assertPushed(ProcessPayment)).toThrow('Expected [ProcessPayment] to be pushed')
  })

  test('assertPushed() with count', async () => {
    await fake.push(makePayload('ProcessPayment'), 'default')
    await fake.push(makePayload('ProcessPayment'), 'default')

    expect(() => fake.assertPushed(ProcessPayment, 2)).not.toThrow()
    expect(() => fake.assertPushed(ProcessPayment, 1)).toThrow('pushed 2 time(s)')
  })

  test('assertPushedOn() checks queue name', async () => {
    await fake.push(makePayload('ProcessPayment'), 'payments')

    expect(() => fake.assertPushedOn('payments', ProcessPayment)).not.toThrow()
    expect(() => fake.assertPushedOn('default', ProcessPayment)).toThrow()
  })

  test('assertNotPushed() passes when job was not pushed', () => {
    expect(() => fake.assertNotPushed(NeverPushed)).not.toThrow()
  })

  test('assertNotPushed() fails when job was pushed', async () => {
    await fake.push(makePayload('NeverPushed'), 'default')
    expect(() => fake.assertNotPushed(NeverPushed)).toThrow('Unexpected [NeverPushed]')
  })

  test('assertNothingPushed() passes for empty fake', () => {
    expect(() => fake.assertNothingPushed()).not.toThrow()
  })

  test('assertNothingPushed() fails when jobs exist', async () => {
    await fake.push(makePayload('SendEmail'), 'default')
    expect(() => fake.assertNothingPushed()).toThrow('Expected no jobs')
  })

  test('assertChained() verifies chain order', async () => {
    const payload = makePayload('ProcessPayment')
    payload.chainedJobs = [
      makePayload('SendEmail'),
      makePayload('NeverPushed'),
    ]
    await fake.push(payload, 'default')

    expect(() => fake.assertChained([ProcessPayment, SendEmail, NeverPushed])).not.toThrow()
  })

  test('assertChained() fails for wrong order', async () => {
    const payload = makePayload('ProcessPayment')
    payload.chainedJobs = [makePayload('SendEmail')]
    await fake.push(payload, 'default')

    expect(() => fake.assertChained([ProcessPayment, NeverPushed])).toThrow()
  })

  test('assertBatched() verifies batch jobs exist', async () => {
    await fake.push(makePayload('ProcessPayment', { batchId: 'b1' }), 'default')
    expect(() => fake.assertBatched()).not.toThrow()
  })

  test('assertBatched() fails when no batch', () => {
    expect(() => fake.assertBatched()).toThrow('Expected a batch')
  })

  test('pushed() returns matching payloads', async () => {
    await fake.push(makePayload('ProcessPayment'), 'default')
    await fake.push(makePayload('SendEmail'), 'default')
    await fake.push(makePayload('ProcessPayment'), 'payments')

    const result = fake.pushed(ProcessPayment)
    expect(result).toHaveLength(2)
  })

  test('reset() clears everything', async () => {
    await fake.push(makePayload('ProcessPayment'), 'default')
    fake.reset()
    expect(() => fake.assertNothingPushed()).not.toThrow()
  })
})
