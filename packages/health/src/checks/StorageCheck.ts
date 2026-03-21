import { HealthCheck } from '../HealthCheck.ts'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Verifies the storage directory is writable.
 *
 * @example
 * health.register(new StorageCheck('./storage'))
 */
export class StorageCheck extends HealthCheck {
  readonly name = 'storage'

  constructor(private storagePath: string = './storage') {
    super()
  }

  override async run(): Promise<void> {
    this.meta('path', this.storagePath)

    if (!existsSync(this.storagePath)) {
      try {
        mkdirSync(this.storagePath, { recursive: true })
      } catch {
        throw new Error(`Storage directory does not exist and cannot be created: ${this.storagePath}`)
      }
    }

    // Write and delete a temp file to verify write access
    const testFile = join(this.storagePath, `.health-check-${Date.now()}`)
    try {
      writeFileSync(testFile, 'ok')
      unlinkSync(testFile)
      this.meta('writable', true)
    } catch (e: any) {
      throw new Error(`Storage directory is not writable: ${e.message}`)
    }
  }
}
