import { ServiceProvider, config } from '@mantiq/core'
import { DatabaseManager, setupModels, setManager } from '@mantiq/database'

export class DatabaseServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(DatabaseManager, () => {
      const manager = new DatabaseManager(config('database'))
      setManager(manager)
      setupModels(manager)
      return manager
    })
  }

  override async boot(): Promise<void> {
    this.app.make(DatabaseManager)
  }
}
