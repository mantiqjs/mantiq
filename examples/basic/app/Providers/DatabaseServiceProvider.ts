import { ServiceProvider, config } from '@mantiq/core'
import { DatabaseManager, setupModels, setManager, Migrator } from '@mantiq/database'

export class DatabaseServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton(DatabaseManager, () => {
      const dbConfig = config('database')
      const manager = new DatabaseManager(dbConfig)

      // Wire the global helpers and set the default Model connection
      setManager(manager)
      setupModels(manager)

      return manager
    })
  }

  async boot(): Promise<void> {
    // Resolve the manager (triggers creation via the singleton factory)
    const manager = this.app.make(DatabaseManager)

    // Auto-run migrations on boot (dev convenience — in production you'd run a CLI command)
    const migrator = new Migrator(manager.connection())
    const migrationsPath = config('app.basePath') + '/database/migrations'
    await migrator.run(await loadMigrations(migrationsPath))
  }
}

async function loadMigrations(dir: string) {
  const glob = new Bun.Glob('*.ts')
  const files: { name: string; migration: any }[] = []

  for await (const file of glob.scan(dir)) {
    const name = file.replace(/\.ts$/, '')
    const mod = await import(`${dir}/${file}`)
    const MigrationClass = mod.default
    if (MigrationClass) {
      files.push({ name, migration: new MigrationClass() })
    }
  }

  files.sort((a, b) => a.name.localeCompare(b.name))
  return files
}
