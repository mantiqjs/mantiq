import { Watcher } from '../contracts/Watcher.ts'
import type { JobEntryContent } from '../contracts/Entry.ts'
import { RecordHeartbeatEntries } from '../jobs/RecordHeartbeatEntries.ts'

/**
 * Records queue job lifecycle events.
 *
 * Listens to JobProcessing, JobProcessed, JobFailed events from @mantiq/queue.
 * Ignores RecordHeartbeatEntries jobs to prevent infinite recursion.
 */
export class JobWatcher extends Watcher {
  private jobStartTimes = new Map<string, number>()

  override register(on: (eventClass: any, handler: (event: any) => void) => void): void {
    try {
      // Dynamic import — @mantiq/queue is an optional peer dependency
      const queue = require('@mantiq/queue')
      on(queue.JobProcessing, (event: any) => this.handleProcessing(event.payload))
      on(queue.JobProcessed, (event: any) => this.handleProcessed(event.payload))
      on(queue.JobFailed, (event: any) => this.handleFailed(event.payload, event.error))
    } catch {
      // @mantiq/queue not available — job watcher won't record
    }
  }

  private isHeartbeatJob(payload: any): boolean {
    return payload?.jobName === RecordHeartbeatEntries.name
  }

  private handleProcessing(payload: any): void {
    if (!this.isEnabled() || this.isHeartbeatJob(payload)) return

    const key = `${payload.jobName}:${payload.data?.jobId ?? Date.now()}`
    this.jobStartTimes.set(key, Date.now())

    const content: JobEntryContent = {
      job_name: payload.jobName,
      queue: payload.queue,
      status: 'processing',
      duration: null,
      attempts: payload.data?.attempts ?? 0,
      error: null,
    }

    this.record('job', content, ['processing'])
  }

  private handleProcessed(payload: any): void {
    if (!this.isEnabled() || this.isHeartbeatJob(payload)) return

    const key = `${payload.jobName}:${payload.data?.jobId ?? ''}`
    const startTime = this.jobStartTimes.get(key)
    const duration = startTime ? Date.now() - startTime : null
    this.jobStartTimes.delete(key)

    const content: JobEntryContent = {
      job_name: payload.jobName,
      queue: payload.queue,
      status: 'processed',
      duration,
      attempts: payload.data?.attempts ?? 0,
      error: null,
    }

    this.record('job', content, ['processed'])
  }

  private handleFailed(payload: any, error: Error): void {
    if (!this.isEnabled() || this.isHeartbeatJob(payload)) return

    const key = `${payload.jobName}:${payload.data?.jobId ?? ''}`
    const startTime = this.jobStartTimes.get(key)
    const duration = startTime ? Date.now() - startTime : null
    this.jobStartTimes.delete(key)

    const content: JobEntryContent = {
      job_name: payload.jobName,
      queue: payload.queue,
      status: 'failed',
      duration,
      attempts: payload.data?.attempts ?? 0,
      error: error.message,
    }

    this.record('job', content, ['failed', payload.jobName])
  }
}
