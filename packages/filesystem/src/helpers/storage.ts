import { Application } from '@mantiq/core'
import type { FilesystemManager } from '../FilesystemManager.ts'
import type { FilesystemDriver } from '../contracts/FilesystemDriver.ts'

export const FILESYSTEM_MANAGER = Symbol('FilesystemManager')

export function storage(): FilesystemManager
export function storage(disk: string): FilesystemDriver
export function storage(disk?: string): FilesystemManager | FilesystemDriver {
  const manager = Application.getInstance().make<FilesystemManager>(FILESYSTEM_MANAGER)
  if (disk === undefined) return manager
  return manager.disk(disk)
}
