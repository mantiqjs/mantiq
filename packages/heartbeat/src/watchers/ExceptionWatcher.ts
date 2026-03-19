import { Watcher } from '../contracts/Watcher.ts'
import type { ExceptionEntryContent } from '../contracts/Entry.ts'
import { errorFingerprint } from '../helpers/fingerprint.ts'

/**
 * Records unhandled exceptions with fingerprinting for grouping.
 *
 * Can be called directly from the exception handler or via events.
 */
export class ExceptionWatcher extends Watcher {
  override register(): void {
    // ExceptionWatcher is driven directly by the exception handler.
    // The HeartbeatServiceProvider wraps the handler to call recordException().
  }

  recordException(error: Error, statusCode: number | null = null): void {
    if (!this.isEnabled()) return

    const ignore = (this.options.ignore as string[]) ?? []
    if (ignore.includes(error.constructor.name)) return

    const fingerprint = errorFingerprint(error)
    const { file, line } = this.extractLocation(error)

    const content: ExceptionEntryContent = {
      class: error.constructor.name,
      message: error.message,
      stack: error.stack ?? '',
      fingerprint,
      status_code: statusCode,
      file,
      line,
    }

    this.record('exception', content, ['exception', error.constructor.name])
  }

  private extractLocation(error: Error): { file: string | null; line: number | null } {
    const stack = error.stack
    if (!stack) return { file: null, line: null }

    const match = stack.match(/at .+\((.+):(\d+):\d+\)/) ?? stack.match(/at (.+):(\d+):\d+/)
    if (!match) return { file: null, line: null }

    return { file: match[1] ?? null, line: match[2] ? parseInt(match[2], 10) : null }
  }
}
