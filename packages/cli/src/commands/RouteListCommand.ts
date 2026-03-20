import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'

export class RouteListCommand extends Command {
  override name = 'route:list'
  override description = 'List all registered routes'
  override usage = 'route:list [--method=GET] [--path=prefix]'

  override async handle(args: ParsedArgs): Promise<number> {
    try {
      const entryPath = `${process.cwd()}/index.ts`
      const mod = await import(entryPath)

      const app = mod.default ?? mod.app
      if (!app) {
        this.io.error('No default export or "app" export found in index.ts')
        return 1
      }

      // Resolve the router from the container
      let router: any = null
      try {
        const { RouterImpl } = await import('@mantiq/core')
        router = app.make?.(RouterImpl)
      } catch {}
      if (!router) {
        try { router = app.make?.('router') } catch {}
      }
      if (!router || typeof router.routes !== 'function') {
        this.io.error('Could not resolve router from the application container.')
        return 1
      }

      let routes: any[] = router.routes()

      // Filter by method
      const methodFilter = args.flags['method'] as string | undefined
      if (methodFilter) {
        const m = methodFilter.toUpperCase()
        routes = routes.filter((r: any) => r.method === m)
      }

      // Filter by path prefix
      const pathFilter = args.flags['path'] as string | undefined
      if (pathFilter) {
        routes = routes.filter((r: any) => r.path.startsWith(pathFilter))
      }

      if (routes.length === 0) {
        this.io.info('No routes found.')
        return 0
      }

      this.io.heading('Registered Routes')
      this.io.newLine()

      this.io.table(
        ['Method', 'Path', 'Name', 'Middleware'],
        routes.map((r: any) => {
          const method = Array.isArray(r.method) ? r.method.join('|') : String(r.method)
          return [
            this.colorMethod(method),
            r.path,
            r.name ?? '',
            Array.isArray(r.middleware) ? r.middleware.join(', ') : (r.middleware ?? ''),
          ]
        }),
      )

      this.io.newLine()
      this.io.muted(`  Showing ${routes.length} route${routes.length !== 1 ? 's' : ''}`)
      return 0
    } catch (e: any) {
      this.io.error(e.message ?? String(e))
      return 1
    }
  }

  private colorMethod(method: string): string {
    switch (method) {
      case 'GET': return this.io.green(method)
      case 'POST': return this.io.cyan(method)
      case 'PUT': return this.io.yellow(method)
      case 'PATCH': return this.io.yellow(method)
      case 'DELETE': return this.io.red(method)
      default: return method
    }
  }
}
