import { Watcher } from '../contracts/Watcher.ts'
import type { CommandEntryContent } from '../contracts/Entry.ts'

/**
 * Records CLI command executions for the Heartbeat dashboard.
 *
 * Captures: command name, arguments, options, exit code, duration, and output.
 *
 * Integration: HeartbeatServiceProvider hooks into the command kernel
 * to feed executed commands to this watcher.
 */
export class CommandWatcher extends Watcher {
  override register(): void {
    // CommandWatcher is driven by wrapping the command kernel.
    // HeartbeatServiceProvider hooks into Command.run().
  }

  recordCommand(data: CommandEntryContent): void {
    if (!this.isEnabled()) return

    this.record('command', data, [data.exit_code === 0 ? 'success' : 'error'])
  }
}
