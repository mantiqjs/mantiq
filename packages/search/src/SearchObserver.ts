import { getSearchManager } from './helpers/search.ts'

/**
 * Model observer that automatically syncs models with the search index.
 * Registered by makeSearchable() on each searchable model class.
 */
export class SearchObserver {
  async saved(model: any): Promise<void> {
    if (typeof model.shouldBeSearchable === 'function' && !model.shouldBeSearchable()) {
      await this.tryDelete(model)
      return
    }
    await this.tryUpdate(model)
  }

  async deleted(model: any): Promise<void> {
    await this.tryDelete(model)
  }

  async forceDeleted(model: any): Promise<void> {
    await this.tryDelete(model)
  }

  async restored(model: any): Promise<void> {
    await this.tryUpdate(model)
  }

  private async tryUpdate(model: any): Promise<void> {
    try {
      const manager = getSearchManager()
      const config = manager.getConfig()

      if (config.queue) {
        // Dispatch to queue if configured
        try {
          const { dispatch } = await import('@mantiq/queue')
          const { MakeSearchableJob } = await import('./jobs/MakeSearchableJob.ts')
          const job = new MakeSearchableJob([model], 'update')
          const queueName = typeof config.queue === 'string' ? config.queue : undefined
          const pending = dispatch(job)
          if (queueName) pending.onQueue(queueName)
        } catch {
          // Queue not available, fall back to sync
          await manager.driver().update([model])
        }
      } else {
        await manager.driver().update([model])
      }
    } catch {
      // Silently fail — search indexing should not break model operations
    }
  }

  private async tryDelete(model: any): Promise<void> {
    try {
      const manager = getSearchManager()
      await manager.driver().delete([model])
    } catch {
      // Silently fail
    }
  }
}
