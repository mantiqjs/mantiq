import { existsSync, mkdirSync } from 'node:fs'

/**
 * Sets up Studio in a Mantiq project.
 *
 * Usage: bun mantiq studio:install
 *
 * Creates:
 *   - app/Studio/AdminPanel.ts (default panel)
 *   - app/Studio/Resources/ (empty directory for resources)
 *   - config/studio.ts (optional config)
 */
export class InstallCommand {
  name = 'studio:install'
  description = 'Install Mantiq Studio in your project'
  usage = 'studio:install'

  io = {
    success: (msg: string) => console.log(`\x1b[32m  DONE\x1b[0m  ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m  ERROR\x1b[0m  ${msg}`),
    info: (msg: string) => console.log(`\x1b[36m  INFO\x1b[0m  ${msg}`),
    step: (msg: string) => console.log(`\n  \x1b[1m${msg}\x1b[0m`),
  }

  async handle(_args: { args: string[]; flags: Record<string, any> }): Promise<number> {
    const cwd = process.cwd()

    this.io.step('Installing Mantiq Studio')

    // 1. Create app/Studio directory
    const studioDir = `${cwd}/app/Studio`
    const resourcesDir = `${studioDir}/Resources`
    mkdirSync(resourcesDir, { recursive: true })

    // 2. Create AdminPanel if it doesn't exist
    const panelPath = `${studioDir}/AdminPanel.ts`
    if (!existsSync(panelPath)) {
      await Bun.write(panelPath, this.panelStub())
      this.io.success('Created app/Studio/AdminPanel.ts')
    } else {
      this.io.info('app/Studio/AdminPanel.ts already exists — skipped')
    }

    // 3. Create config/studio.ts if it doesn't exist
    const configDir = `${cwd}/config`
    mkdirSync(configDir, { recursive: true })
    const configPath = `${configDir}/studio.ts`
    if (!existsSync(configPath)) {
      await Bun.write(configPath, this.configStub())
      this.io.success('Created config/studio.ts')
    } else {
      this.io.info('config/studio.ts already exists — skipped')
    }

    // 4. Create app/Providers/StudioServiceProvider.ts if it doesn't exist
    const providersDir = `${cwd}/app/Providers`
    mkdirSync(providersDir, { recursive: true })
    const providerPath = `${providersDir}/StudioServiceProvider.ts`
    if (!existsSync(providerPath)) {
      await Bun.write(providerPath, this.providerStub())
      this.io.success('Created app/Providers/StudioServiceProvider.ts')
    } else {
      this.io.info('app/Providers/StudioServiceProvider.ts already exists — skipped')
    }

    // 5. Done
    console.log(`
  \x1b[32m✓\x1b[0m  \x1b[1mStudio installed\x1b[0m

  \x1b[2mNext steps:\x1b[0m

  1. Create a resource:
     bun mantiq make:resource UserResource
     bun mantiq make:resource PostResource --generate

  2. Add resources to your panel:
     Edit app/Studio/AdminPanel.ts

  3. Start the dev server:
     bun run dev

  4. Visit /admin in your browser
`)
    return 0
  }

  private panelStub(): string {
    return `import { StudioPanel } from '@mantiq/studio'

export class AdminPanel extends StudioPanel {
  override path = '/admin'
  override brandName = 'Admin'

  // Resources are auto-discovered from app/Studio/Resources/.
  // To register explicitly instead, override resources():
  //
  // import { UserResource } from './Resources/UserResource.ts'
  // override resources() { return [UserResource] }

  override colors() {
    return {
      primary: '#2563eb',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    }
  }
}
`
  }

  private providerStub(): string {
    return `import { StudioServiceProvider as BaseProvider } from '@mantiq/studio'

export class StudioServiceProvider extends BaseProvider {}
`
  }

  private configStub(): string {
    return `/**
 * Studio configuration.
 *
 * Panels are auto-discovered from app/Studio/.
 * This config file is optional — only needed for advanced settings.
 */
export default {
  /**
   * Explicit panel registration (optional).
   * If empty, panels are auto-discovered from app/Studio/.
   */
  panels: [],

  /**
   * Default auth guard for all panels.
   * Each panel can override this with its own guard() method.
   */
  guard: 'web',

  /**
   * Login URL — where to redirect unauthenticated users.
   */
  loginUrl: '/login',
}
`
  }
}
