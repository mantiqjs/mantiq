import { env } from '@mantiq/core'

export default {
  default: env('AI_PROVIDER', 'openai'),

  providers: {
    openai: {
      driver: 'openai' as const,
      apiKey: env('OPENAI_API_KEY', ''),
    },
    anthropic: {
      driver: 'anthropic' as const,
      apiKey: env('ANTHROPIC_API_KEY', ''),
    },
    gemini: {
      driver: 'gemini' as const,
      apiKey: env('GEMINI_API_KEY', ''),
    },
    ollama: {
      driver: 'ollama' as const,
      host: env('OLLAMA_HOST', 'http://localhost'),
      port: 11434,
    },
  },

  defaultModel: env('AI_MODEL', 'gpt-4o'),

  embeddings: {
    default: 'openai',
    providers: {},
    defaultModel: 'text-embedding-3-small',
  },

  vectorStores: {
    default: 'memory',
    stores: {
      memory: { driver: 'memory' as const },
    },
  },

  observability: {
    enabled: true,
    logRequests: env('AI_LOG_REQUESTS', 'false') === 'true',
    trackCosts: true,
  },

  limits: {
    maxTokensPerRequest: 4096,
    maxCostPerDay: 100.00,
  },
}
