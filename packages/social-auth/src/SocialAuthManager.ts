import type { OAuthProvider } from './contracts/OAuthProvider.ts'
import type { ProviderConfig } from './AbstractProvider.ts'
import { GoogleProvider } from './providers/GoogleProvider.ts'
import { GitHubProvider } from './providers/GitHubProvider.ts'
import { FacebookProvider } from './providers/FacebookProvider.ts'
import { AppleProvider } from './providers/AppleProvider.ts'
import { TwitterProvider } from './providers/TwitterProvider.ts'
import { LinkedInProvider } from './providers/LinkedInProvider.ts'
import { MicrosoftProvider } from './providers/MicrosoftProvider.ts'
import { DiscordProvider } from './providers/DiscordProvider.ts'

export interface SocialAuthConfig {
  [provider: string]: ProviderConfig
}

/**
 * Manager for social authentication providers.
 *
 * Lazily instantiates providers on first access and caches them.
 * Supports all 8 built-in providers and custom providers via `extend()`.
 *
 * @example
 * const manager = new SocialAuthManager(config)
 * const github = manager.driver('github')
 * return github.redirect()
 */
export class SocialAuthManager {
  private readonly instances = new Map<string, OAuthProvider>()
  private readonly customCreators = new Map<string, (config: ProviderConfig) => OAuthProvider>()

  /** Built-in provider name → constructor mapping. */
  private static readonly builtInProviders: Record<
    string,
    new (config: ProviderConfig) => OAuthProvider
  > = {
    google: GoogleProvider,
    github: GitHubProvider,
    facebook: FacebookProvider,
    apple: AppleProvider,
    twitter: TwitterProvider,
    linkedin: LinkedInProvider,
    microsoft: MicrosoftProvider,
    discord: DiscordProvider,
  }

  constructor(private readonly config: SocialAuthConfig) {}

  /**
   * Get a provider instance by name (lazy init + cache).
   */
  driver(name: string): OAuthProvider {
    if (!this.instances.has(name)) {
      this.instances.set(name, this.createDriver(name))
    }

    return this.instances.get(name)!
  }

  /**
   * Register a custom provider factory.
   * Overrides built-in providers if the name matches.
   */
  extend(name: string, factory: (config: ProviderConfig) => OAuthProvider): void {
    this.customCreators.set(name, factory)
    // Clear cached instance so the new factory takes effect
    this.instances.delete(name)
  }

  /**
   * List all available provider names (built-in + custom + configured).
   */
  getProviders(): string[] {
    const names = new Set<string>([
      ...Object.keys(SocialAuthManager.builtInProviders),
      ...this.customCreators.keys(),
      ...Object.keys(this.config),
    ])
    return [...names]
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private createDriver(name: string): OAuthProvider {
    // Custom creators take precedence — they may not need config
    const custom = this.customCreators.get(name)
    if (custom) {
      const providerConfig = this.config[name] ?? {}
      return custom(providerConfig as ProviderConfig)
    }

    const providerConfig = this.config[name]
    if (!providerConfig) {
      throw new Error(
        `Social auth provider "${name}" is not configured. ` +
          `Add it to your social-auth config file.`,
      )
    }

    // Built-in providers
    const ProviderClass = SocialAuthManager.builtInProviders[name]
    if (ProviderClass) {
      return new ProviderClass(providerConfig)
    }

    throw new Error(
      `Unknown social auth provider "${name}". ` +
        `Use extend() to register custom providers.`,
    )
  }
}
