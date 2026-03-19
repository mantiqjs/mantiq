import { describe, test, expect, beforeEach } from 'bun:test'
import { Chain, setChainResolver } from '../../src/JobChain.ts'
import { QueueManager } from '../../src/QueueManager.ts'
import { SyncDriver } from '../../src/drivers/SyncDriver.ts'
import { Job } from '../../src/Job.ts'

class StepOne extends Job {
  override async handle(): Promise<void> {}
}

class StepTwo extends Job {
  override async handle(): Promise<void> {}
}

class StepThree extends Job {
  override async handle(): Promise<void> {}
}

class CatchHandler extends Job {
  override async handle(): Promise<void> {}
}

let driver: SyncDriver
let manager: QueueManager

beforeEach(() => {
  driver = new SyncDriver()
  manager = new QueueManager(
    { default: 'sync', connections: { sync: { driver: 'sync' } } },
    new Map([['sync', () => driver]]),
  )
  setChainResolver(() => manager)
})

describe('Chain', () => {
  test('Chain.of() creates a chain', () => {
    const chain = Chain.of([new StepOne(), new StepTwo()])
    expect(chain).toBeDefined()
  })

  test('Chain.of() throws for empty array', () => {
    expect(() => Chain.of([])).toThrow('requires at least one job')
  })

  test('dispatch() pushes first job with chainedJobs in payload', async () => {
    await Chain.of([
      new StepOne(),
      new StepTwo(),
      new StepThree(),
    ]).dispatch()

    expect(await driver.size('default')).toBe(1)
    const job = await driver.pop('default')
    expect(job!.payload.jobName).toBe('StepOne')
    expect(job!.payload.chainedJobs).toHaveLength(2)
    expect(job!.payload.chainedJobs![0]!.jobName).toBe('StepTwo')
    expect(job!.payload.chainedJobs![1]!.jobName).toBe('StepThree')
  })

  test('catch() attaches a catch handler', async () => {
    await Chain.of([new StepOne(), new StepTwo()])
      .catch(new CatchHandler())
      .dispatch()

    const job = await driver.pop('default')
    expect(job!.payload.chainCatchJob).toBeDefined()
    expect(job!.payload.chainCatchJob!.jobName).toBe('CatchHandler')
  })

  test('onQueue() overrides queue for all chain jobs', async () => {
    await Chain.of([new StepOne(), new StepTwo()])
      .onQueue('priority')
      .dispatch()

    expect(await driver.size('priority')).toBe(1)
    const job = await driver.pop('priority')
    expect(job!.payload.queue).toBe('priority')
    expect(job!.payload.chainedJobs![0]!.queue).toBe('priority')
  })

  test('onConnection() overrides connection for all chain jobs', async () => {
    await Chain.of([new StepOne(), new StepTwo()])
      .onConnection('sync')
      .dispatch()

    const job = await driver.pop('default')
    expect(job!.payload.connection).toBe('sync')
    expect(job!.payload.chainedJobs![0]!.connection).toBe('sync')
  })

  test('single-job chain has no chainedJobs', async () => {
    await Chain.of([new StepOne()]).dispatch()

    const job = await driver.pop('default')
    expect(job!.payload.chainedJobs).toBeUndefined()
  })
})
