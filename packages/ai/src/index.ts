// ── Contracts ────────────────────────────────────────────────────────────────
export type { AIDriver } from './contracts/AIDriver.ts'
export type { AIConfig, ProviderConfig, ModelPricing } from './contracts/AIConfig.ts'
export { DEFAULT_CONFIG } from './contracts/AIConfig.ts'
export type {
  ChatMessage,
  ChatRole,
  ChatOptions,
  ChatResponse,
  ChatChunk,
  TokenUsage,
  ContentPart,
  TextPart,
  ImageUrlPart,
  ImageBase64Part,
  AudioPart,
  VideoPart,
  FilePart,
  ToolCall,
  ToolDefinition,
  ResponseFormat,
  FinishReason,
} from './contracts/ChatMessage.ts'
export type { EmbedOptions, EmbeddingResult } from './contracts/Embedding.ts'
export type {
  ImageGenerateOptions,
  ImageEditOptions,
  ImageResult,
  GeneratedImage,
} from './contracts/Image.ts'
export type {
  AudioSpeechOptions,
  AudioTranscribeOptions,
  TranscriptionResult,
  TranscriptionSegment,
  TranscriptionWord,
} from './contracts/Audio.ts'
export type { ModerationOptions, ModerationResult, ModerationItem } from './contracts/Moderation.ts'
export type {
  VectorStore,
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
  VectorStoreConfig,
} from './contracts/VectorStore.ts'
export type { AIMiddleware, AIRequest, AINextFunction } from './middleware/AIMiddleware.ts'

// ── Core ─────────────────────────────────────────────────────────────────────
export { AIManager } from './AIManager.ts'
export { PendingChat } from './PendingChat.ts'

// ── Drivers ──────────────────────────────────────────────────────────────────
export { OpenAIDriver } from './drivers/OpenAIDriver.ts'
export { AnthropicDriver } from './drivers/AnthropicDriver.ts'
export { GeminiDriver } from './drivers/GeminiDriver.ts'
export { OllamaDriver } from './drivers/OllamaDriver.ts'
export { AzureOpenAIDriver } from './drivers/AzureOpenAIDriver.ts'
export { BedrockDriver } from './drivers/BedrockDriver.ts'
export { NullDriver } from './drivers/NullDriver.ts'

// ── Embeddings ───────────────────────────────────────────────────────────────
export { EmbeddingManager } from './embeddings/EmbeddingManager.ts'

// ── Vector Stores ────────────────────────────────────────────────────────────
export { InMemoryVectorStore } from './vectorStores/InMemoryVectorStore.ts'
export { PgVectorStore } from './vectorStores/PgVectorStore.ts'
export type { QueryExecutor, PgVectorStoreOptions } from './vectorStores/PgVectorStore.ts'

// ── RAG ──────────────────────────────────────────────────────────────────────
export { RAGPipeline } from './rag/RAGPipeline.ts'
export { TextSplitter } from './rag/TextSplitter.ts'
export { DocumentLoader } from './rag/DocumentLoader.ts'

// ── Agents ───────────────────────────────────────────────────────────────────
export { Agent } from './agents/Agent.ts'
export { AgentTool } from './agents/AgentTool.ts'
export type { Memory } from './agents/Memory.ts'
export { BufferMemory, WindowMemory, SummaryMemory } from './agents/Memory.ts'

// ── Prompts ──────────────────────────────────────────────────────────────────
export { PromptManager } from './prompts/PromptManager.ts'
export { Prompt } from './prompts/Prompt.ts'

// ── Observability ────────────────────────────────────────────────────────────
export { UsageTracker } from './observability/UsageTracker.ts'
export type { UsageRecord, UsageReport } from './observability/UsageTracker.ts'

// ── Guards ───────────────────────────────────────────────────────────────────
export { ModelPolicy } from './guards/ModelPolicy.ts'
export { UsageQuota } from './guards/UsageQuota.ts'

// ── AI Middleware ────────────────────────────────────────────────────────────
export { CostTrackingMiddleware } from './middleware/CostTrackingMiddleware.ts'
export { ContentModerationMiddleware } from './middleware/ContentModerationMiddleware.ts'
export { PIIRedactionMiddleware } from './middleware/PIIRedactionMiddleware.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────
export { ai, AI_MANAGER } from './helpers/ai.ts'
export { estimateCost, MODEL_PRICING } from './helpers/cost.ts'

// ── Commands ────────────────────────────────────────────────────────────────
export { AIChatCommand } from './commands/AIChatCommand.ts'
export { MakeAIToolCommand } from './commands/MakeAIToolCommand.ts'
export { AIEmbedCommand } from './commands/AIEmbedCommand.ts'
export { AIPromptListCommand } from './commands/AIPromptListCommand.ts'
export { AICostReportCommand } from './commands/AICostReportCommand.ts'

// ── Service Provider ─────────────────────────────────────────────────────────
export { AIServiceProvider } from './AIServiceProvider.ts'

// ── Testing ──────────────────────────────────────────────────────────────────
export { AIFake } from './testing/AIFake.ts'

// ── Errors ───────────────────────────────────────────────────────────────────
export { AIError } from './errors/AIError.ts'
