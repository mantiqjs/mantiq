import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'

export class ServeCommand extends Command {
  name = 'serve'
  description = 'Start the development server'
  usage = 'serve [--port=3000] [--host=0.0.0.0]'

  async handle(args: ParsedArgs): Promise<number> {
    const port = args.flags['port'] ? Number(args.flags['port']) : undefined
    const host = args.flags['host'] as string | undefined

    try {
      // Load the app entry point
      const entryPath = `${process.cwd()}/index.ts`
      const mod = await import(entryPath)

      const app = mod.default ?? mod.app
      if (!app) {
        this.io.error('No default export or "app" export found in index.ts')
        return 1
      }

      // Resolve the HTTP kernel and start serving
      const kernel = app.make?.('HttpKernel') ?? app.make?.('httpKernel')
      if (!kernel) {
        this.io.error('Could not resolve HttpKernel from the application container.')
        return 1
      }

      // Override port/host if provided via flags
      if (port) app.make?.('config')?.set?.('app.port', port)
      if (host) app.make?.('config')?.set?.('app.host', host)

      await kernel.start()
      // Server is now running — keep process alive
      return new Promise(() => {}) // never resolves, keeps the process running
    } catch (e: any) {
      this.io.error(e.message ?? String(e))
      return 1
    }
  }
}
