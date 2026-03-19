import type { HeartbeatConfig } from '../contracts/HeartbeatConfig.ts'

/**
 * Decide whether to sample (record) a given entry.
 *
 * @param config - The heartbeat config
 * @param isError - Whether this entry represents an error (exception, failed job, etc.)
 * @returns true if the entry should be recorded
 */
export function shouldSample(config: HeartbeatConfig, isError = false): boolean {
  if (!config.enabled) return false
  if (isError && config.sampling.always_sample_errors) return true
  if (config.sampling.rate >= 1.0) return true
  if (config.sampling.rate <= 0) return false
  return Math.random() < config.sampling.rate
}
