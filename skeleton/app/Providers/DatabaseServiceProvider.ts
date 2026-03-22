import { ServiceProvider, config } from '@mantiq/core'
import { DatabaseManager, setupModels, setManager, Migrator } from '@mantiq/database'
import { applyHasApiTokens, PersonalAccessToken } from '@mantiq/auth'
import { User } from '../Models/User.ts'

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
    const manager = this.app.make(DatabaseManager)

    // Set up PersonalAccessToken connection and apply HasApiTokens mixin
    PersonalAccessToken.setConnection(manager.connection())
    applyHasApiTokens(User)
  }
}
