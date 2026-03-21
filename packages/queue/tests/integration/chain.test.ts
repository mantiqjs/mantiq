import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Worker } from '../../src/Worker.ts'
import { QueueManager } from '../../src/QueueManager.ts'
import { SQLiteDriver } from '../../src/drivers/SQLiteDriver.ts'
import { Job } from '../../src/Job.ts'
import { Chain } from '../../src/JobChain.ts'
import { setChainResolver } from '../../src/JobChain.ts'
import { registerJob, clearJobRegistry } from '../../src/JobRegistry.ts'
import type { SerializedPayload } from '../../src/contracts/JobContract.ts'

// ── Test job classes ──────────────────────────────────────────────

let executionLog: string[] = []

class StepJob extends Job {
  constructor(public step?: string) { super() }
  override async handle(): Promise<void> {
    executionLog.push(this.step ?? 'unknown')
  }
}

class FailingStepJob extends Job {
  override tries = 1
  constructor(public step?: string) { super() }
  override async handle(): Promise<void> {
    executionLog.push(`fail-${this.step ?? 'unknown'}`)
    throw new Error(`step ${this.step} failed`)
  }
}

class CatchHandlerJob extends Job {
  constructor(public reason?: string) { super() }
  override async handle(): Promise<void> {
    executionLog.push(`catch:${this.reason ?? 'default'}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function makePayload(
  jobName: string,
  data: Record<string, any> = {},
  overrides?: Partial<SerializedPayload>,
): SerializedPayload {
  return {
    jobName,
    data,
    queue: 'default',
    connection: null,
    tries: 3,
    backoff: '0',
    timeout: 60,
    delay: 0,
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────

let driver: SQLiteDriver
let manager: QueueManager

beforeEach(() => {
  executionLog = []
  clearJobRegistry()
  registerJob(StepJob)
  registerJob(FailingStepJob)
  registerJob(CatchHandlerJob)

  driver = new SQLiteDriver(':memory:')
  manager = new QueueManager(
    { default: 'sqlite', connections: { sqlite: { driver: 'sqlite', path: ':memory:' } } },
    new Map([['sqlite', () => driver]]),
  )
  QueueManager._dispatcher = null
  setChainResolver(() => manager)
})

afterEach(() => {
  driver.close()
})

describe('Job chain (integration with SQLiteDriver)', () => {
  test('chain of 3 jobs executes in sequential order', async () => {
    // Build chain payload manually (same as Chain.dispatch() does internally)
    const payload = makePayload('StepJob', { step: 'step-1' })
    payload.chainedJobs = [
      makePayload('StepJob', { step: 'step-2' }),
      makePayload('StepJob', { step: 'step-3' }),
    ]
    await driver.push(payload, 'default')

    // Worker processes entire chain with stopWhenEmpty
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(executionLog).toEqual(['step-1', 'step-2', 'step-3'])
    expect(await driver.size('default')).toBe(0)
  })

  test('chain stops on failure — remaining jobs are not dispatched', async () => {
    const payload = makePayload('StepJob', { step: 'step-1' })
    payload.chainedJobs = [
      makePayload('FailingStepJob', { step: 'step-2' }, { tries: 1 }),
      makePayload('StepJob', { step: 'step-3' }),
    ]
    await driver.push(payload, 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // step-1 succeeds, step-2 fails, step-3 never runs
    expect(executionLog).toEqual(['step-1', 'fail-step-2'])
    expect(await driver.size('default')).toBe(0)
    const failed = await driver.getFailedJobs()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.payload.jobName).toBe('FailingStepJob')
  })

  test('chain failure dispatches catch handler', async () => {
    const payload = makePayload('FailingStepJob', { step: 'step-1' }, { tries: 1 })
    payload.chainedJobs = [
      makePayload('StepJob', { step: 'step-2' }),
    ]
    payload.chainCatchJob = makePayload('CatchHandlerJob', { reason: 'chain-broke' })

    await driver.push(payload, 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // step-1 fails, catch handler runs, step-2 never runs
    expect(executionLog).toEqual(['fail-step-1', 'catch:chain-broke'])
    expect(await driver.size('default')).toBe(0)
  })

  test('catch handler is propagated through chain and fires on later failure', async () => {
    const payload = makePayload('StepJob', { step: 'step-1' })
    payload.chainedJobs = [
      makePayload('StepJob', { step: 'step-2' }),
      makePayload('FailingStepJob', { step: 'step-3' }, { tries: 1 }),
    ]
    payload.chainCatchJob = makePayload('CatchHandlerJob', { reason: 'late-failure' })

    await driver.push(payload, 'default')

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    // step-1 and step-2 succeed, step-3 fails, catch handler runs
    expect(executionLog).toEqual(['step-1', 'step-2', 'fail-step-3', 'catch:late-failure'])
  })

  test('Chain.of().dispatch() pushes chain to SQLite', async () => {
    const chain = Chain.of([
      new StepJob('a'),
      new StepJob('b'),
      new StepJob('c'),
    ])

    await chain.dispatch()

    // Should have pushed the first job (with chained payloads inside)
    expect(await driver.size('default')).toBe(1)

    // Process all
    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(executionLog).toEqual(['a', 'b', 'c'])
  })

  test('Chain.of().catch().dispatch() attaches catch handler', async () => {
    const chain = Chain.of([
      new FailingStepJob('x'),
      new StepJob('y'),
    ]).catch(new CatchHandlerJob('caught-via-api'))

    // FailingStepJob defaults to tries=1
    await chain.dispatch()

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(executionLog).toContain('fail-x')
    expect(executionLog).toContain('catch:caught-via-api')
    expect(executionLog).not.toContain('y')
  })

  test('chain with single job works without chained payloads', async () => {
    const chain = Chain.of([new StepJob('only-one')])
    await chain.dispatch()

    const worker = new Worker(manager, { stopWhenEmpty: true })
    await worker.run()

    expect(executionLog).toEqual(['only-one'])
  })

  test('Chain.of() throws if given empty array', () => {
    expect(() => Chain.of([])).toThrow('requires at least one job')
  })
})
