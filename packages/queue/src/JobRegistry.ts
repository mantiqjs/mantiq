import type { Job } from './Job.ts'
import type { Constructor } from './contracts/JobContract.ts'

/**
 * Maps job class names to their constructors.
 * Used by the Worker to reconstruct job instances from serialized payloads.
 *
 * Jobs must be registered before the worker starts processing.
 */
const registry = new Map<string, Constructor<Job>>()

/** Register a job class so it can be deserialized by the worker */
export function registerJob(jobClass: Constructor<Job>): void {
  registry.set(jobClass.name, jobClass)
}

/** Register multiple job classes at once */
export function registerJobs(jobClasses: Constructor<Job>[]): void {
  for (const cls of jobClasses) {
    registry.set(cls.name, cls)
  }
}

/** Look up a job constructor by its class name */
export function resolveJob(name: string): Constructor<Job> | undefined {
  return registry.get(name)
}

/** Get all registered job classes (for debugging/testing) */
export function getRegisteredJobs(): Map<string, Constructor<Job>> {
  return new Map(registry)
}

/** Clear the registry (primarily for testing) */
export function clearJobRegistry(): void {
  registry.clear()
}
