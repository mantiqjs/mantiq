import type { Constructor } from '@mantiq/core'

export interface GuardConfig {
  driver: string    // 'session' | custom driver name
  provider: string  // Name referencing a provider in config.providers
  trackLastUsed?: boolean | undefined
}

export interface ProviderConfig {
  driver: string           // 'database' | custom driver name
  model: Constructor<any>  // The User model class
}

export interface AuthConfig {
  defaults: {
    guard: string
  }
  guards: Record<string, GuardConfig>
  providers: Record<string, ProviderConfig>
}
