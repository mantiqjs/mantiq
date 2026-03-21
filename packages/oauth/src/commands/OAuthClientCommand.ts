import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { Client } from '../models/Client.ts'

/**
 * Create a new OAuth client.
 *
 * Usage: mantiq oauth:client <name> [--redirect=URL] [--personal] [--password]
 */
export class OAuthClientCommand extends Command {
  override name = 'oauth:client'
  override description = 'Create a new OAuth client'
  override usage = 'oauth:client <name> [--redirect=URL] [--personal] [--password]'

  override async handle(args: ParsedArgs): Promise<number> {
    const name = args.args[0]
    if (!name) {
      this.io.error('Client name is required.')
      this.io.muted('  Usage: mantiq oauth:client <name> [--redirect=URL]')
      return 1
    }

    const redirect = (args.flags['redirect'] as string) || 'http://localhost'
    const personal = !!args.flags['personal']
    const password = !!args.flags['password']

    const clientId = crypto.randomUUID()
    const secret = crypto.randomUUID()

    await Client.create({
      id: clientId,
      name,
      secret,
      redirect,
      personal_access_client: personal,
      password_client: password,
      revoked: false,
    })

    this.io.success(`OAuth client "${name}" created successfully.`)
    this.io.newLine()
    this.io.twoColumn('Client ID:', clientId)
    this.io.twoColumn('Client Secret:', secret)
    this.io.twoColumn('Redirect URL:', redirect)
    this.io.twoColumn('Personal Access:', personal ? 'Yes' : 'No')
    this.io.twoColumn('Password Grant:', password ? 'Yes' : 'No')

    return 0
  }
}
