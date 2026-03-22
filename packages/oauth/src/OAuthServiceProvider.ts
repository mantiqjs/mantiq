import { ServiceProvider, ConfigRepository, HttpKernel } from '@mantiq/core'
import type { Router } from '@mantiq/core'
import { ROUTER } from '@mantiq/core'
import { AuthManager } from '@mantiq/auth'
import { OAuthServer } from './OAuthServer.ts'
import type { OAuthConfig } from './OAuthServer.ts'
import { JwtSigner } from './jwt/JwtSigner.ts'
import { JwtGuard } from './guards/JwtGuard.ts'
import { CheckScopes } from './middleware/CheckScopes.ts'
import { CheckForAnyScope } from './middleware/CheckForAnyScope.ts'
import { CheckClientCredentials } from './middleware/CheckClientCredentials.ts'
import { AuthCodeGrant } from './grants/AuthCodeGrant.ts'
import { ClientCredentialsGrant } from './grants/ClientCredentialsGrant.ts'
import { RefreshTokenGrant } from './grants/RefreshTokenGrant.ts'
import { PersonalAccessGrant } from './grants/PersonalAccessGrant.ts'
import { oauthRoutes } from './routes/oauthRoutes.ts'
import { OAUTH_SERVER } from './helpers/oauth.ts'
import { registerCommands } from '@mantiq/cli'
import { OAuthClientCommand } from './commands/OAuthClientCommand.ts'
import { OAuthInstallCommand } from './commands/OAuthInstallCommand.ts'
import { OAuthKeysCommand } from './commands/OAuthKeysCommand.ts'
import { OAuthPurgeCommand } from './commands/OAuthPurgeCommand.ts'
import { readFile } from 'node:fs/promises'

const DEFAULT_CONFIG: OAuthConfig = {
  tokenLifetime: 3600,
  refreshTokenLifetime: 1209600,
  privateKeyPath: 'storage/oauth-private.key',
  publicKeyPath: 'storage/oauth-public.key',
}

/**
 * Service provider for the OAuth package.
 *
 * register(): binds OAuthServer + JwtSigner as singletons
 * boot(): loads keys, registers the 'oauth' guard on AuthManager, registers routes, binds middleware
 */
export class OAuthServiceProvider extends ServiceProvider {
  override register(): void {
    // OAuthServer singleton
    this.app.singleton(OAuthServer, (c) => {
      const config = c.make(ConfigRepository).get<OAuthConfig>('oauth', DEFAULT_CONFIG)
      return new OAuthServer(config)
    })
    this.app.alias(OAuthServer, OAUTH_SERVER)

    // JwtSigner singleton
    this.app.singleton(JwtSigner, () => new JwtSigner())

    // Middleware bindings
    this.app.bind(CheckScopes, () => new CheckScopes())
    this.app.bind(CheckForAnyScope, () => new CheckForAnyScope())
    this.app.bind(CheckClientCredentials, (c) => new CheckClientCredentials(c.make(JwtSigner)))
  }

  override async boot(): Promise<void> {
    const server = this.app.make(OAuthServer)
    const signer = this.app.make(JwtSigner)

    // Load RSA keys if they exist
    try {
      const privateKey = await readFile(server.privateKeyPath, 'utf-8')
      const publicKey = await readFile(server.publicKeyPath, 'utf-8')
      await signer.loadKeys(privateKey, publicKey)
    } catch {
      console.warn('[Mantiq] OAuth RSA keys not found. Run `bun mantiq oauth:install` to generate them.')
    }

    // Register 'oauth' guard on AuthManager
    try {
      const authManager = this.app.make(AuthManager)
      authManager.extend('oauth', () => {
        const provider = authManager.createUserProvider('users')
        return new JwtGuard(signer, provider)
      })
    } catch {
      if (process.env.APP_DEBUG === 'true') {
        console.warn('[Mantiq] OAuthServiceProvider: @mantiq/auth not installed, oauth guard not registered')
      }
    }

    // Register OAuth routes
    try {
      const router = this.app.make<Router>(ROUTER)
      const grants = [
        new AuthCodeGrant(signer, server),
        new ClientCredentialsGrant(signer, server),
        new RefreshTokenGrant(signer, server),
        new PersonalAccessGrant(signer, server),
      ]
      oauthRoutes(router, { server, grants })
    } catch {
      if (process.env.APP_DEBUG === 'true') {
        console.warn('[Mantiq] OAuthServiceProvider: Router not available, OAuth routes not registered')
      }
    }

    // Register middleware aliases
    try {
      const kernel = this.app.make(HttpKernel)
      kernel.registerMiddleware('scopes', CheckScopes as any)
      kernel.registerMiddleware('scope', CheckForAnyScope as any)
      kernel.registerMiddleware('client', CheckClientCredentials as any)
    } catch {
      if (process.env.APP_DEBUG === 'true') {
        console.warn('[Mantiq] OAuthServiceProvider: HttpKernel not available, OAuth middleware not registered')
      }
    }

    // Register commands
    try {
      registerCommands([
        new OAuthClientCommand(),
        new OAuthInstallCommand(),
        new OAuthKeysCommand(),
        new OAuthPurgeCommand(),
      ])
    } catch {
      // CLI not available — commands optional
    }
  }
}
