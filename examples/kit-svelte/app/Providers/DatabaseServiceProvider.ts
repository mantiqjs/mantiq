import { ServiceProvider, config } from '@mantiq/core'
import { DatabaseManager, setupModels, setManager, Migrator } from '@mantiq/database'

export class DatabaseServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(DatabaseManager, () => {
      const dbConfig = config('database')
      const manager = new DatabaseManager(dbConfig)

      setManager(manager)
      setupModels(manager)

      return manager
    })
  }

  override async boot(): Promise<void> {
    // Resolve the manager (triggers creation via the singleton factory)
    this.app.make(DatabaseManager)
  }
}
