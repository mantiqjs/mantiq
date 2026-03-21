import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { JwtSigner } from '../jwt/JwtSigner.ts'
import { Client } from '../models/Client.ts'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * Generate OAuth RSA keys and create a personal access client.
 *
 * Usage: mantiq oauth:install
 */
export class OAuthInstallCommand extends Command {
  override name = 'oauth:install'
  override description = 'Run the commands necessary to prepare OAuth for use'

  override async handle(_args: ParsedArgs): Promise<number> {
    this.io.info('Installing OAuth server...')

    // Generate keys
    const signer = new JwtSigner()
    const keyPair = await signer.generateKeyPair()

    const privatePath = 'storage/oauth-private.key'
    const publicPath = 'storage/oauth-public.key'

    const privateExists = existsSync(privatePath)
    const publicExists = existsSync(publicPath)

    if (privateExists || publicExists) {
      this.io.warn('OAuth keys already exist. Skipping key generation.')
    } else {
      await writeFile(privatePath, keyPair.privateKey, 'utf-8')
      await writeFile(publicPath, keyPair.publicKey, 'utf-8')
      this.io.success('OAuth keys generated successfully.')
      this.io.muted(`  Private key: ${privatePath}`)
      this.io.muted(`  Public key:  ${publicPath}`)
    }

    // Create personal access client
    const existingClient = await Client.where('personal_access_client', true).first()
    if (existingClient) {
      this.io.warn('Personal access client already exists. Skipping.')
    } else {
      const clientId = crypto.randomUUID()
      const secret = crypto.randomUUID()

      await Client.create({
        id: clientId,
        name: 'Personal Access Client',
        secret,
        redirect: 'http://localhost',
        personal_access_client: true,
        password_client: false,
        revoked: false,
      })

      this.io.success('Personal access client created successfully.')
      this.io.muted(`  Client ID:     ${clientId}`)
      this.io.muted(`  Client Secret: ${secret}`)
    }

    this.io.newLine()
    this.io.success('OAuth installation complete.')
    return 0
  }
}
