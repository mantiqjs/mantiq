import type { VectorStoreConfig } from './VectorStore.ts'

// ── Provider Configs (Discriminated Union) ───────────────────────────────────

export type ProviderConfig =
  | { driver: 'openai'; apiKey: string; organization?: string; baseUrl?: string }
  | { driver: 'anthropic'; apiKey: string; baseUrl?: string; apiVersion?: string }
  | { driver: 'gemini'; apiKey: string; project?: string; location?: string }
  | { driver: 'ollama'; host?: string; port?: number }
  | { driver: 'azure-openai'; apiKey: string; endpoint: string; deploymentId: string; apiVersion?: string }
  | { driver: 'bedrock'; region: string; accessKeyId?: string; secretAccessKey?: string; profile?: string }
  | { driver: 'null' }

// ── Model Pricing ────────────────────────────────────────────────────────────

export interface ModelPricing {
  promptPer1k: number
  completionPer1k: number
}

// ── Top-Level Config ─────────────────────────────────────────────────────────

export interface AIConfig {
  /** Default provider name. */
  default: string

  /** Named provider connections. */
  providers: Record<string, ProviderConfig>

  /** Default model when none specified. */
  defaultModel?: string

  /** Embedding configuration. */
  embeddings?: {
    default: string
    providers: Record<string, ProviderConfig>
    defaultModel?: string
  }

  /** Vector store configuration. */
  vectorStores?: {
    default: string
    stores: Record<string, VectorStoreConfig>
  }

  /** Observability settings. */
  observability?: {
    enabled: boolean
    logRequests: boolean
    trackCosts: boolean
    slowRequestThreshold?: number
  }

  /** Usage limits. */
  limits?: {
    maxTokensPerRequest?: number
    maxCostPerDay?: number
    maxRequestsPerMinute?: number
  }

  /** Known model pricing for cost tracking. */
  pricing?: Record<string, ModelPricing>
}

export const DEFAULT_CONFIG: AIConfig = {
  default: 'null',
  providers: {
    null: { driver: 'null' },
  },
}
