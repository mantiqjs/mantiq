import { ServiceProvider, ConfigRepository } from '@mantiq/core'
import { AIManager } from './AIManager.ts'
import { AI_MANAGER } from './helpers/ai.ts'
import { EmbeddingManager } from './embeddings/EmbeddingManager.ts'
import { PromptManager } from './prompts/PromptManager.ts'
import { UsageTracker } from './observability/UsageTracker.ts'
import type { AIConfig } from './contracts/AIConfig.ts'
import { DEFAULT_CONFIG } from './contracts/AIConfig.ts'

export class AIServiceProvider extends ServiceProvider {
  override register(): void {
    const config = this.app.make(ConfigRepository).get<AIConfig>('ai', DEFAULT_CONFIG)

    this.app.singleton(AIManager, () => new AIManager(config))
    this.app.alias(AIManager, AI_MANAGER)

    this.app.singleton(EmbeddingManager, () => {
      const manager = this.app.make(AIManager)
      const embeddingConfig = config.embeddings
      return new EmbeddingManager(manager, embeddingConfig?.default, embeddingConfig?.defaultModel)
    })

    this.app.singleton(PromptManager, () => new PromptManager())
    this.app.singleton(UsageTracker, () => new UsageTracker())
  }

  override async boot(): Promise<void> {
    try {
      const { registerCommands } = await import('@mantiq/cli')
      const { AIChatCommand } = await import('./commands/AIChatCommand.ts')
      const { MakeAIToolCommand } = await import('./commands/MakeAIToolCommand.ts')
      const { AIEmbedCommand } = await import('./commands/AIEmbedCommand.ts')
      const { AIPromptListCommand } = await import('./commands/AIPromptListCommand.ts')
      const { AICostReportCommand } = await import('./commands/AICostReportCommand.ts')

      registerCommands([
        new AIChatCommand(),
        new MakeAIToolCommand(),
        new AIEmbedCommand(),
        new AIPromptListCommand(),
        new AICostReportCommand(),
      ])
    } catch {
      // @mantiq/cli may not be installed
    }
  }
}
