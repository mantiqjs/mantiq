import { Application } from '@mantiq/core'
import type { LoggerDriver } from '../contracts/Logger.ts'
import type { LogManager } from '../LogManager.ts'

export const LOGGING_MANAGER = Symbol('LogManager')

export function log(): LogManager
export function log(channel: string): LoggerDriver
export function log(channel?: string): LogManager | LoggerDriver {
  const manager = Application.getInstance().make<LogManager>(LOGGING_MANAGER)
  if (channel === undefined) return manager
  return manager.channel(channel)
}
