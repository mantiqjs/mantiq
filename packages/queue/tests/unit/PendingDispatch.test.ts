import { describe, test, expect, beforeEach } from 'bun:test'
import { PendingDispatch, setPendingDispatchResolver } from '../../src/PendingDispatch.ts'
import { QueueManager } from '../../src/QueueManager.ts'
import { SyncDriver } from '../../src/drivers/SyncDriver.ts'
import { Job } from '../../src/Job.ts'

class SendEmail extends Job {
  constructor(public to: string) { super() }
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
  setPendingDispatchResolver(() => manager)
})

describe('PendingDispatch', () => {
  test('send() pushes job to queue', async () => {
    const pd = new PendingDispatch(new SendEmail('a@b.com'))
    await pd.send()

    expect(await driver.size('default')).toBe(1)
    const job = await driver.pop('default')
    expect(job!.payload.jobName).toBe('SendEmail')
    expect(job!.payload.data.to).toBe('a@b.com')
  })

  test('thenable: await pushes the job', async () => {
    await new PendingDispatch(new SendEmail('c@d.com'))
    expect(await driver.size('default')).toBe(1)
  })

  test('delay() sets the delay', async () => {
    await new PendingDispatch(new SendEmail('x@y.com')).delay(60)
    // Job should exist but not be poppable (it's delayed)
    expect(await driver.size('default')).toBe(1)
    expect(await driver.pop('default')).toBeNull()
  })

  test('onQueue() overrides the queue', async () => {
    await new PendingDispatch(new SendEmail('q@q.com')).onQueue('emails')
    expect(await driver.size('emails')).toBe(1)
    expect(await driver.size('default')).toBe(0)
  })

  test('chaining delay + onQueue', async () => {
    await new PendingDispatch(new SendEmail('z@z.com'))
      .delay(30)
      .onQueue('high')

    expect(await driver.size('high')).toBe(1)
    expect(await driver.pop('high')).toBeNull() // delayed
  })
})
