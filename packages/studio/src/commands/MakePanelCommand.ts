import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Generates a Studio Panel class.
 *
 * Usage: bun mantiq make:panel AdminPanel
 *
 * Creates app/Studio/AdminPanel.ts with a panel configuration.
 */
export class MakePanelCommand {
  name = 'make:panel'
  description = 'Create a new Studio panel'
  usage = 'make:panel <name> [--force]'

  io = {
    success: (msg: string) => console.log(`\x1b[32m  DONE\x1b[0m  ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m  ERROR\x1b[0m  ${msg}`),
    info: (msg: string) => console.log(`\x1b[36m  INFO\x1b[0m  ${msg}`),
  }

  async handle(args: { args: string[]; flags: Record<string, any> }): Promise<number> {
    const rawName = args.args[0]
    if (!rawName) {
      this.io.error('Please provide a panel name. Usage: make:panel <name>')
      this.io.info('Example: bun mantiq make:panel AdminPanel')
      return 1
    }

    // Normalize name
    let className = rawName
    if (!className.endsWith('Panel')) className += 'Panel'
    className = className.charAt(0).toUpperCase() + className.slice(1)

    const panelPath = this.derivePath(className)
    const dir = `${process.cwd()}/app/Studio`
    const filePath = `${dir}/${className}.ts`

    if (existsSync(filePath) && !args.flags['force']) {
      this.io.error(`${className}.ts already exists. Use --force to overwrite.`)
      return 1
    }

    mkdirSync(dirname(filePath), { recursive: true })

    const stub = this.generateStub(className, panelPath)
    await Bun.write(filePath, stub)

    this.io.success(`Created app/Studio/${className}.ts`)
    this.io.info(`Panel will be served at ${panelPath}`)
    this.io.info('Add resources with: bun mantiq make:resource UserResource')

    // Also create the Resources directory
    const resourcesDir = `${dir}/Resources`
    if (!existsSync(resourcesDir)) {
      mkdirSync(resourcesDir, { recursive: true })
      this.io.success('Created app/Studio/Resources/')
    }

    return 0
  }

  private derivePath(className: string): string {
    // AdminPanel -> /admin, CustomerPanel -> /customer
    const name = className.replace(/Panel$/, '')
    return '/' + name.toLowerCase()
  }

  private generateStub(className: string, path: string): string {
    const brandName = className.replace(/Panel$/, '')

    return `import { StudioPanel } from '@mantiq/studio'
import type { Authenticatable } from '@mantiq/auth'

export class ${className} extends StudioPanel {
  /**
   * URL path prefix for this panel.
   * Visit ${path} to access this panel.
   */
  override path = '${path}'

  /**
   * Brand name shown in the sidebar header.
   */
  override brandName = '${brandName}'

  /**
   * Resources managed by this panel.
   * Import and list your Resource classes here.
   *
   * Example:
   *   import { UserResource } from './Resources/UserResource.ts'
   *   import { PostResource } from './Resources/PostResource.ts'
   *
   *   resources() { return [UserResource, PostResource] }
   */
  override resources() {
    return []
  }

  /**
   * Gate: who can access this panel?
   * Return true to allow, false to deny (403).
   *
   * Example: only admins
   *   canAccess(user: Authenticatable) { return user.hasRole('admin') }
   */
  override canAccess(_user: Authenticatable): boolean {
    return true
  }

  /**
   * Theme colors for this panel.
   * Override to customize the panel appearance.
   */
  override colors() {
    return {
      primary: '#2563eb',   // Blue
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    }
  }

  /**
   * Enable dark mode toggle.
   */
  override darkMode() {
    return true
  }
}
`
  }
}
