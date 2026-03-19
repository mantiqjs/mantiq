import { Watcher } from '../contracts/Watcher.ts'
import type { ModelEntryContent } from '../contracts/Entry.ts'

/**
 * Records ORM model create/update/delete operations.
 *
 * Hooks into model lifecycle events to capture what changed.
 */
export class ModelWatcher extends Watcher {
  override register(on: (eventClass: any, handler: (event: any) => void) => void): void {
    // Model events will be registered when @mantiq/database ORM is ready.
    // For now, the watcher provides a public API for manual recording.
  }

  recordModelEvent(data: {
    modelClass: string
    action: 'created' | 'updated' | 'deleted'
    key: string | number | null
    changes: Record<string, { old: any; new: any }> | null
  }): void {
    if (!this.isEnabled()) return

    const content: ModelEntryContent = {
      model_class: data.modelClass,
      action: data.action,
      key: data.key,
      changes: data.changes,
    }

    this.record('model', content, [data.action, data.modelClass])
  }
}
