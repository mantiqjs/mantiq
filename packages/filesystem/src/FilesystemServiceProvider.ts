import { ServiceProvider, ConfigRepository, Application } from '@mantiq/core'
import { FilesystemManager } from './FilesystemManager.ts'
import { FILESYSTEM_MANAGER } from './helpers/storage.ts'
import type { FilesystemConfig } from './contracts/FilesystemConfig.ts'

const DEFAULT_CONFIG: FilesystemConfig = {
  default: 'local',
  disks: {
    local: { driver: 'local', root: 'storage/app' },
  },
}

export class FilesystemServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(FilesystemManager, (c) => {
      const config = c.make(ConfigRepository).get<FilesystemConfig>('filesystem', DEFAULT_CONFIG)
      const app = c.make(Application as any) as Application

      // Normalize relative root paths to absolute using the app base path
      for (const disk of Object.values(config.disks)) {
        if (disk.root && !disk.root.startsWith('/')) {
          disk.root = app.basePath_(disk.root)
        }
      }

      return new FilesystemManager(config)
    })
    this.app.alias(FilesystemManager, FILESYSTEM_MANAGER)
  }
}
