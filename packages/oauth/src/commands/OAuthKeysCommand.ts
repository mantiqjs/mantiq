import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { JwtSigner } from '../jwt/JwtSigner.ts'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * Generate the RSA key pair for signing JWTs.
 *
 * Usage: mantiq oauth:keys [--force]
 */
export class OAuthKeysCommand extends Command {
  override name = 'oauth:keys'
  override description = 'Generate the encryption keys for API authentication'
  override usage = 'oauth:keys [--force]'

  override async handle(args: ParsedArgs): Promise<number> {
    const force = !!args.flags['force']
    const privatePath = 'storage/oauth-private.key'
    const publicPath = 'storage/oauth-public.key'

    if (!force) {
      if (existsSync(privatePath) || existsSync(publicPath)) {
        this.io.error('OAuth keys already exist. Use --force to overwrite.')
        return 1
      }
    }

    this.io.info('Generating RSA key pair...')

    const signer = new JwtSigner()
    const keyPair = await signer.generateKeyPair()

    await writeFile(privatePath, keyPair.privateKey, 'utf-8')
    await writeFile(publicPath, keyPair.publicKey, 'utf-8')

    this.io.success('OAuth keys generated successfully.')
    this.io.muted(`  Private key: ${privatePath}`)
    this.io.muted(`  Public key:  ${publicPath}`)

    return 0
  }
}
