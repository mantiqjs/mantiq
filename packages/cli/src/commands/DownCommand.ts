import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'

export class DownCommand extends Command {
  override name = 'down'
  override description = 'Put the application into maintenance mode'
  override usage = 'down [--retry=<seconds>] [--secret=<token>]'

  override async handle(args: ParsedArgs): Promise<number> {
    const storagePath = `${process.cwd()}/storage/framework`
    if (!existsSync(storagePath)) mkdirSync(storagePath, { recursive: true })

    const data: Record<string, any> = {
      time: Date.now(),
      retry: args.options['retry'] ? Number(args.options['retry']) : null,
      secret: (args.options['secret'] as string) || null,
    }

    writeFileSync(`${storagePath}/down`, JSON.stringify(data))
    this.io.success('  Application is now in maintenance mode.')

    if (data.secret) {
      this.io.line(`  Bypass: ${process.env.APP_URL ?? 'http://localhost:3000'}/${data.secret}`)
    }

    return 0
  }
}
