import type { AIDriver } from './contracts/AIDriver.ts'
import type { AIConfig, ProviderConfig } from './contracts/AIConfig.ts'
import type { EmbedOptions, EmbeddingResult } from './contracts/Embedding.ts'
import type { TokenUsage } from './contracts/ChatMessage.ts'
import type { AIMiddleware } from './middleware/AIMiddleware.ts'
import { DEFAULT_CONFIG } from './contracts/AIConfig.ts'
import { PendingChat } from './PendingChat.ts'
import { AIError } from './errors/AIError.ts'

import { OpenAIDriver } from './drivers/OpenAIDriver.ts'
import { AnthropicDriver } from './drivers/AnthropicDriver.ts'
import { GeminiDriver } from './drivers/GeminiDriver.ts'
import { OllamaDriver } from './drivers/OllamaDriver.ts'
import { AzureOpenAIDriver } from './drivers/AzureOpenAIDriver.ts'
import { BedrockDriver } from './drivers/BedrockDriver.ts'
import { NullDriver } from './drivers/NullDriver.ts'

/**
 * AIManager — driver manager for AI providers.
 *
 * @example
 *   const manager = new AIManager(config)
 *   const response = await manager.chat('gpt-4o').user('Hello').send()
 *   await manager.driver('anthropic').chat(messages)
 */
export class AIManager {
  /** Hook for observability — called after every AI request. */
  static _onRequest: ((data: {
    provider: string
    model: string
    tokens: TokenUsage
    duration: number
    cost: number
  }) => void) | null = null

  private config: AIConfig
  private drivers = new Map<string, AIDriver>()
  private customDrivers = new Map<string, () => AIDriver>()
  private middlewares: AIMiddleware[] = []

  constructor(config?: Partial<AIConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Get or create a driver by provider name. */
  driver(name?: string): AIDriver {
    const driverName = name ?? this.config.default

    if (this.drivers.has(driverName)) {
      return this.drivers.get(driverName)!
    }

    const driver = this.createDriver(driverName)
    this.drivers.set(driverName, driver)
    return driver
  }

  /** Alias for driver(). */
  provider(name?: string): AIDriver {
    return this.driver(name)
  }

  /** Start a fluent chat builder. */
  chat(model?: string): PendingChat {
    const pending = new PendingChat(this)
    if (model) pending.model(model)
    else if (this.config.defaultModel) pending.model(this.config.defaultModel)
    return pending
  }

  /** Generate embeddings using the default or named provider. */
  async embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    const providerName = this.config.embeddings?.default ?? this.config.default
    return this.driver(providerName).embed(input, options)
  }

  /** Register an AI middleware to be applied to all chat requests. */
  use(middleware: AIMiddleware): this {
    this.middlewares.push(middleware)
    return this
  }

  /** Get all registered AI middlewares. */
  getMiddlewares(): AIMiddleware[] {
    return this.middlewares
  }

  /** Register a custom driver factory. */
  extend(name: string, factory: () => AIDriver): void {
    this.customDrivers.set(name, factory)
    this.drivers.delete(name)
  }

  /** Get the default provider name. */
  getDefaultDriver(): string {
    return this.config.default
  }

  /** Get the default model name. */
  getDefaultModel(): string | undefined {
    return this.config.defaultModel
  }

  /** Get the full config. */
  getConfig(): AIConfig {
    return this.config
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private createDriver(name: string): AIDriver {
    const customFactory = this.customDrivers.get(name)
    if (customFactory) return customFactory()

    const providerConfig = this.config.providers[name]
    if (!providerConfig) {
      throw new AIError(`AI provider "${name}" is not configured.`, {
        available: Object.keys(this.config.providers),
      })
    }

    return this.resolveDriver(providerConfig)
  }

  private resolveDriver(config: ProviderConfig): AIDriver {
    switch (config.driver) {
      case 'openai':
        return new OpenAIDriver(config)
      case 'anthropic':
        return new AnthropicDriver(config)
      case 'gemini':
        return new GeminiDriver(config)
      case 'ollama':
        return new OllamaDriver(config)
      case 'azure-openai':
        return new AzureOpenAIDriver(config)
      case 'bedrock':
        return new BedrockDriver(config)
      case 'null':
        return new NullDriver()
      default:
        throw new AIError(`Unsupported AI driver: "${(config as any).driver}"`)
    }
  }
}
