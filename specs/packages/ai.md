# @mantiq/ai — Design Specification

## 1. Overview

`@mantiq/ai` is a multi-provider AI integration package for MantiqJS. It follows the Manager + Driver architecture used by `@mantiq/mail` and `@mantiq/search`, providing a unified interface across AI providers with support for all standard capabilities: text generation, vision, image generation, audio (TTS/STT), embeddings, moderation, RAG, agents, and tool calling.

### Design Principles

1. **No SDK dependencies** — all drivers use raw `fetch()` to provider APIs
2. **NullDriver default** — works without API keys in development
3. **Streaming via AsyncIterable** — idiomatic `for await...of`
4. **AI middleware ≠ HTTP middleware** — separate pipeline for AI-specific concerns
5. **Enterprise-ready** — cost tracking, usage quotas, PII redaction, model policies out of the box

---

## 2. Package Structure

```
packages/ai/
  src/
    index.ts                           # Barrel exports
    AIManager.ts                       # Manager class (driver cache + resolution)
    AIServiceProvider.ts               # IoC registration + CLI command boot
    PendingChat.ts                     # Fluent builder for chat requests

    contracts/
      AIConfig.ts                      # ProviderConfig discriminated union, AIConfig, DEFAULT_CONFIG
      AIDriver.ts                      # Core driver interface (chat, stream, embed, generateImage, speak, transcribe, moderate)
      Audio.ts                         # AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult
      ChatMessage.ts                   # ChatMessage, ChatOptions, ChatResponse, ChatChunk, TokenUsage, ToolCall, ToolDefinition, ContentPart (text, image, audio, video, file)
      Embedding.ts                     # EmbedOptions, EmbeddingResult
      Image.ts                         # ImageGenerateOptions, ImageResult, GeneratedImage
      Moderation.ts                    # ModerationOptions, ModerationResult
      VectorStore.ts                   # VectorStore interface, VectorDocument, VectorSearchResult, VectorStoreConfig

    drivers/
      OpenAIDriver.ts                  # Full: chat, stream, embed, image (DALL-E), TTS, STT (Whisper), moderation
      AnthropicDriver.ts               # Chat, stream, vision — throws AIError for unsupported methods
      GeminiDriver.ts                  # Chat, stream, embed, image (Imagen), multimodal (audio/video/file content parts)
      OllamaDriver.ts                  # Chat, stream, embed, vision (multimodal models)
      AzureOpenAIDriver.ts             # Delegates to OpenAIDriver with Azure URL scheme + auth
      BedrockDriver.ts                 # Chat, stream, embed (Titan), image (Titan) — AWS SigV4 signing
      NullDriver.ts                    # No-op driver, returns empty responses

    embeddings/
      EmbeddingManager.ts              # Batch embedding, similarity helpers

    vectorStores/
      InMemoryVectorStore.ts           # Cosine similarity, metadata filtering — dev/test/small datasets

    rag/
      TextSplitter.ts                  # Chunk by separator, paragraph, markdown headers, sentence
      DocumentLoader.ts                # Load text, markdown, JSON, CSV files
      RAGPipeline.ts                   # Ingest → embed → upsert; query → embed → search → generate

    agents/
      Agent.ts                         # Autonomous tool-using loop (max iterations, callbacks)
      AgentTool.ts                     # Abstract base class for user-defined tools
      Memory.ts                        # BufferMemory, WindowMemory, SummaryMemory

    prompts/
      Prompt.ts                        # {{variable}} interpolation, versioning
      PromptManager.ts                 # Registry of named, versioned prompts

    middleware/
      AIMiddleware.ts                  # AIRequest, AINextFunction, AIMiddleware interface
      CostTrackingMiddleware.ts        # Token cost estimation with built-in pricing table
      ContentModerationMiddleware.ts   # Pre-flight content check (patterns, length, block/warn)
      PIIRedactionMiddleware.ts        # Redact email, phone, SSN, credit card, IP before sending

    observability/
      UsageTracker.ts                  # Token, cost, latency records — report by model/provider

    guards/
      ModelPolicy.ts                   # Allow/deny models per user/role
      UsageQuota.ts                    # Per-user/team token/cost/request limits with period reset

    helpers/
      ai.ts                           # Global ai() helper + AI_MANAGER symbol
      cost.ts                         # estimateCost(), MODEL_PRICING table

    testing/
      AIFake.ts                        # Canned responses, sequence support, assertions (assertSent, assertModelUsed, etc.)

    errors/
      AIError.ts                       # Extends MantiqError

    commands/
      AIChatCommand.ts                 # mantiq ai:chat — interactive streaming REPL
      MakeAIToolCommand.ts             # mantiq make:ai-tool — generates AgentTool stub
```

---

## 3. Configuration

File: `config/ai.ts`

```typescript
export default {
  default: env('AI_PROVIDER', 'openai'),

  providers: {
    openai: {
      driver: 'openai',
      apiKey: env('OPENAI_API_KEY', ''),
      organization: env('OPENAI_ORGANIZATION'),
    },
    anthropic: {
      driver: 'anthropic',
      apiKey: env('ANTHROPIC_API_KEY', ''),
    },
    gemini: {
      driver: 'gemini',
      apiKey: env('GEMINI_API_KEY', ''),
    },
    ollama: {
      driver: 'ollama',
      host: env('OLLAMA_HOST', 'http://localhost'),
      port: 11434,
    },
    'azure-openai': {
      driver: 'azure-openai',
      apiKey: env('AZURE_OPENAI_API_KEY', ''),
      endpoint: env('AZURE_OPENAI_ENDPOINT', ''),
      deploymentId: env('AZURE_OPENAI_DEPLOYMENT', ''),
    },
    bedrock: {
      driver: 'bedrock',
      region: env('AWS_REGION', 'us-east-1'),
    },
  },

  defaultModel: env('AI_MODEL', 'gpt-4o'),

  embeddings: {
    default: 'openai',
    providers: { /* inherits from providers above or override */ },
    defaultModel: 'text-embedding-3-small',
  },

  vectorStores: {
    default: 'memory',
    stores: {
      memory: { driver: 'memory' },
      pgvector: { driver: 'pgvector', connection: 'default', table: 'embeddings', dimensions: 1536 },
    },
  },

  observability: {
    enabled: true,
    logRequests: env('AI_LOG_REQUESTS', 'false') === 'true',
    trackCosts: true,
    slowRequestThreshold: 5000, // ms
  },

  limits: {
    maxTokensPerRequest: 4096,
    maxCostPerDay: 100.00,
    maxRequestsPerMinute: 60,
  },
}
```

---

## 4. Core Contracts

### 4.1 AIDriver

Every provider implements this interface. Methods that the provider does not support throw `AIError`.

```typescript
interface AIDriver {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk>
  embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult>
  generateImage(prompt: string, options?: ImageGenerateOptions): Promise<ImageResult>
  speak(text: string, options?: AudioSpeechOptions): Promise<Uint8Array>
  transcribe(audio: Uint8Array | string, options?: AudioTranscribeOptions): Promise<TranscriptionResult>
  moderate(input: string | string[], options?: ModerationOptions): Promise<ModerationResult>
}
```

### 4.2 Provider Capability Matrix

| Capability        | OpenAI | Anthropic | Gemini | Ollama | Azure OpenAI | Bedrock |
|-------------------|--------|-----------|--------|--------|--------------|---------|
| Chat              | ✅     | ✅        | ✅     | ✅     | ✅           | ✅      |
| Streaming         | ✅     | ✅        | ✅     | ✅     | ✅           | ✅      |
| Vision            | ✅     | ✅        | ✅     | ✅     | ✅           | ✅      |
| Tool calling      | ✅     | ✅        | ✅     | ✅     | ✅           | ✅      |
| Structured output | ✅     | ✅        | ✅     | ✅     | ✅           | ✅      |
| Embeddings        | ✅     | ❌        | ✅     | ✅     | ✅           | ✅      |
| Image generation  | ✅     | ❌        | ✅     | ❌     | ✅           | ✅      |
| TTS               | ✅     | ❌        | ❌     | ❌     | ✅           | ❌      |
| STT               | ✅     | ❌        | ❌     | ❌     | ✅           | ❌      |
| Moderation        | ✅     | ❌        | ❌     | ❌     | ❌           | ❌      |

### 4.3 Multimodal Content Parts

Messages can contain mixed content types:

```typescript
type ContentPart =
  | TextPart           // { type: 'text', text }
  | ImageUrlPart       // { type: 'image_url', imageUrl, detail? }
  | ImageBase64Part    // { type: 'image_base64', imageBase64, mimeType }
  | AudioPart          // { type: 'audio', audioBase64, mimeType }
  | VideoPart          // { type: 'video', videoUrl?, videoBase64?, mimeType }
  | FilePart           // { type: 'file', fileUrl?, fileBase64?, mimeType, filename? }
```

---

## 5. API Surface

### 5.1 Simple Chat

```typescript
const response = await ai('gpt-4o').user('Explain TypeScript generics.').send()
console.log(response.content)
```

### 5.2 Fluent Builder

```typescript
const response = await ai()
  .chat('claude-sonnet-4-20250514')
  .via('anthropic')
  .system('You are a code reviewer.')
  .user(code)
  .temperature(0.3)
  .maxTokens(2048)
  .send()
```

### 5.3 Streaming

```typescript
for await (const chunk of ai('gpt-4o').user('Write a poem.').stream()) {
  process.stdout.write(chunk.delta)
}
```

### 5.4 Vision

```typescript
const response = await ai('gpt-4o')
  .user([
    { type: 'text', text: 'What is in this image?' },
    { type: 'image_url', imageUrl: 'https://example.com/photo.jpg' },
  ])
  .send()
```

### 5.5 Image Generation

```typescript
const result = await ai().driver('openai').generateImage('A sunset over mountains', {
  model: 'dall-e-3',
  size: '1024x1024',
  quality: 'hd',
})
console.log(result.images[0].url)
```

### 5.6 Text-to-Speech

```typescript
const audio = await ai().driver('openai').speak('Hello, welcome to MantiqJS!', {
  voice: 'nova',
  responseFormat: 'mp3',
})
await Bun.write('greeting.mp3', audio)
```

### 5.7 Speech-to-Text

```typescript
const result = await ai().driver('openai').transcribe('recording.wav', {
  model: 'whisper-1',
  language: 'en',
})
console.log(result.text)
```

### 5.8 Structured Output

```typescript
const response = await ai('gpt-4o')
  .user('List 3 programming languages with their year of creation')
  .structuredOutput({
    type: 'object',
    properties: {
      languages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            year: { type: 'number' },
          },
        },
      },
    },
  })
  .send()

const data = JSON.parse(response.content)
```

### 5.9 Tool / Function Calling

```typescript
const response = await ai('gpt-4o')
  .user('What is the weather in London?')
  .tools([{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  }])
  .send()

if (response.toolCalls.length > 0) {
  const call = response.toolCalls[0]
  const args = JSON.parse(call.function.arguments) // { city: 'London' }
}
```

### 5.10 Embeddings

```typescript
const result = await ai().embed(['Hello world', 'Goodbye world'], {
  model: 'text-embedding-3-small',
  dimensions: 256,
})
console.log(result.embeddings[0].length) // 256
```

### 5.11 Content Moderation

```typescript
const result = await ai().driver('openai').moderate('some text to check')
if (result.results[0].flagged) {
  console.log('Content flagged:', result.results[0].categories)
}
```

---

## 6. AIManager

The central manager class. Follows the MailManager pattern exactly:

- `driver(name?)` — lazy-load and cache a driver by provider name
- `provider(name?)` — alias for `driver()`
- `chat(model?)` — returns a `PendingChat` fluent builder
- `embed(input, options?)` — embed using the default embedding provider
- `extend(name, factory)` — register custom driver factories
- `getDefaultDriver()` — returns the configured default provider name
- `getDefaultModel()` — returns the configured default model name

### Service Provider Registration

```typescript
class AIServiceProvider extends ServiceProvider {
  override register(): void {
    const config = this.app.make(ConfigRepository).get<AIConfig>('ai', DEFAULT_CONFIG)
    this.app.singleton(AIManager, () => new AIManager(config))
    this.app.alias(AIManager, AI_MANAGER)
    this.app.singleton(PromptManager, () => new PromptManager())
    this.app.singleton(UsageTracker, () => new UsageTracker())
  }

  override async boot(): Promise<void> {
    // Register CLI commands if @mantiq/cli is installed
  }
}
```

---

## 7. Drivers

### 7.1 OpenAI (Full-featured reference driver)

- **Chat**: `POST /chat/completions` — maps `ChatMessage[]` to OpenAI format, handles multimodal content parts
- **Streaming**: SSE via `ReadableStream`, parses `data:` lines, yields `ChatChunk`
- **Embeddings**: `POST /embeddings` — supports `text-embedding-3-small`, `text-embedding-3-large`, custom dimensions
- **Images**: `POST /images/generations` — DALL-E 3, supports size/quality/style/n
- **TTS**: `POST /audio/speech` — returns raw audio bytes (`Uint8Array`)
- **STT**: `POST /audio/transcriptions` — Whisper, multipart form upload, supports verbose JSON with timestamps
- **Moderation**: `POST /moderations` — returns category flags and scores

### 7.2 Anthropic

- Maps unified `ChatMessage[]` to Anthropic format (separate `system` field, `messages` array)
- Supports vision via `image` content blocks (URL or base64)
- Tool calling maps to Anthropic's `tool_use` / `tool_result` blocks
- Streaming uses Anthropic's SSE event types (`message_start`, `content_block_delta`, `message_delta`)

### 7.3 Gemini

- Maps to Google's `generateContent` / `streamGenerateContent` API
- System prompt via `systemInstruction`
- Full multimodal: `inlineData` for base64, `fileData` for URLs (audio, video, files)
- Structured output via `responseMimeType` + `responseSchema`
- Embeddings via `batchEmbedContents`

### 7.4 Ollama

- Local inference at `http://localhost:11434`
- NDJSON streaming (not SSE)
- Vision via `images` field (base64 array)
- Embeddings via `/api/embeddings`
- JSON mode via `format: 'json'`

### 7.5 Azure OpenAI

- Delegates to `OpenAIDriver` with Azure URL scheme: `{endpoint}/openai/deployments/{deployment}/`
- Uses `api-key` header instead of `Bearer` token (handled by URL routing)

### 7.6 Bedrock

- AWS Converse API for chat
- AWS SigV4 signing implemented in pure TypeScript (crypto.subtle)
- Titan embeddings and Titan image generation
- Streaming via event stream

### 7.7 NullDriver

- Returns empty responses for all methods
- Default driver when no provider is configured
- Allows the package to be installed without API keys

---

## 8. RAG Pipeline

### 8.1 TextSplitter

Chunking strategies:
- `split(text)` — by separator (default `\n\n`)
- `splitByParagraph(text)` — by paragraph boundaries
- `splitByMarkdownHeaders(text)` — by `#` headers
- `splitBySentence(text)` — by sentence boundaries

Configurable `chunkSize` (default 1000 chars) and `chunkOverlap` (default 200 chars).

### 8.2 DocumentLoader

File format support:
- `.txt` — plain text
- `.md` — markdown
- `.json` — single object or array, optional `contentField`
- `.csv` — one document per row, optional `contentColumns`
- `fromString()` — raw string input

### 8.3 RAGPipeline

```typescript
const rag = new RAGPipeline(ai(), vectorStore, {
  model: 'gpt-4o',
  topK: 5,
  embeddingModel: 'text-embedding-3-small',
  systemPrompt: 'Answer based on context...\n\n{context}',
})

// Ingest documents
await rag.ingest([
  { content: 'MantiqJS is a TypeScript framework...', metadata: { source: 'docs' } },
])

// Query
const answer = await rag.query('What is MantiqJS?')
```

Pipeline: ingest → split → embed → upsert → (query) → embed question → search → build context → generate

### 8.4 Vector Stores

Interface:
```typescript
interface VectorStore {
  upsert(documents: VectorDocument[]): Promise<void>
  search(embedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>
  delete(ids: string[]): Promise<void>
  count(): Promise<number>
}
```

Implementations:
- **InMemoryVectorStore** — cosine similarity, metadata filtering. Built-in, zero deps.
- **PgVectorStore** — pgvector extension for PostgreSQL (planned)
- **PineconeVectorStore** — Pinecone managed vector DB (planned)
- **QdrantVectorStore** — Qdrant vector search engine (planned)
- **WeaviateVectorStore** — Weaviate vector DB (planned)

---

## 9. Agents

### 9.1 AgentTool

```typescript
abstract class AgentTool {
  abstract name: string
  abstract description: string
  abstract parameters: Record<string, any>  // JSON Schema
  abstract execute(args: Record<string, any>): Promise<string>
  toDefinition(): ToolDefinition
}
```

### 9.2 Agent Loop

```typescript
const agent = new Agent(ai(), {
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant with access to tools.',
  maxIterations: 10,
  onToolCall: (name, args) => console.log(`Calling ${name}`, args),
})

agent.addTool(new SearchTool())
agent.addTool(new CalculatorTool())

const result = await agent.run('Find all overdue invoices and calculate the total')
// result: { content, iterations, toolCallsExecuted, totalTokens }
```

Loop: send messages → check for tool_calls → execute tools → feed results back → repeat until no tool calls or max iterations.

### 9.3 Memory

- **BufferMemory** — keeps all messages (unbounded)
- **WindowMemory** — keeps last N messages (sliding window)
- **SummaryMemory** — summarizes older messages, keeps recent N in full

---

## 10. AI Middleware

Separate from HTTP middleware. Wraps AI requests.

```typescript
interface AIMiddleware {
  handle(request: AIRequest, next: AINextFunction): Promise<ChatResponse>
}
```

### 10.1 CostTrackingMiddleware

- Built-in pricing table for OpenAI, Anthropic, Gemini models
- Estimates cost from `TokenUsage` per response
- `onCost` callback for downstream tracking

### 10.2 ContentModerationMiddleware

- Pre-flight check on user messages before sending to AI
- Configurable blocked patterns (regex), max length
- `block` (throw) or `warn` (log) action modes

### 10.3 PIIRedactionMiddleware

- Regex-based detection: email, phone, SSN, credit card, IP address
- Configurable replacement string (default `[REDACTED]`)
- Custom patterns supported
- Only redacts `user` role messages

---

## 11. Observability

### UsageTracker

```typescript
const tracker = app.make(UsageTracker)
tracker.record({ provider: 'openai', model: 'gpt-4o', ... })

const report = tracker.report({ since: startOfDay })
// { totalTokens, totalCost, requestCount, avgLatencyMs, byModel, byProvider }
```

---

## 12. Guards

### 12.1 ModelPolicy

```typescript
const policy = new ModelPolicy()
policy.allow('gpt-4o', (user) => user.plan === 'pro')
policy.deny('gpt-4-turbo')
policy.setDefault(true) // allow unlisted models
policy.can(user, 'gpt-4o') // boolean
```

### 12.2 UsageQuota

```typescript
const quota = new UsageQuota()
quota.setLimit('free', { maxTokens: 100_000, maxRequests: 100, period: 'day' })
quota.setLimit('pro', { maxTokens: 1_000_000, maxCost: 10, period: 'day' })

const check = quota.check('user:123', 'free')
// { allowed: boolean, remaining: { tokens, cost, requests }, resetsAt: Date }

quota.record('user:123', 'free', usage, cost)
```

---

## 13. Prompt Management

```typescript
const prompts = app.make(PromptManager)
prompts.register('translate', new Prompt('Translate "{{text}}" to {{language}}', {}, '1.0'))
prompts.register('translate', new Prompt('You are a translator. Translate: {{text}} → {{language}}', {}, '2.0'))

const prompt = prompts.get('translate')        // latest version
const v1 = prompts.get('translate', '1.0')     // specific version
const rendered = prompt.with({ text: 'Hello', language: 'French' }).render()
```

---

## 14. Testing

```typescript
import { AIFake } from '@mantiq/ai'

const fake = new AIFake()
fake.respondWith({ content: 'Mocked response', model: 'fake' })

// Or sequential responses
fake.respondWithSequence([
  { content: 'First' },
  { content: 'Second' },
])

// For other modalities
fake.respondWithEmbedding({ embeddings: [[0.1, 0.2]], model: 'fake', usage: { totalTokens: 5 } })
fake.respondWithTranscription({ text: 'Hello world' })

// Use in tests, then assert
fake.assertSent(1)
fake.assertModelUsed('gpt-4o')
fake.assertSentWith((req) => req.messages?.some(m => m.content === 'test'))
fake.assertMethodCalled('embed', 2)
fake.assertNothingSent()

// Inspect
fake.sent()           // all requests
fake.sentFor('chat')  // only chat requests
fake.reset()          // clear state
```

---

## 15. CLI Commands

| Command | Description |
|---------|-------------|
| `mantiq ai:chat` | Interactive streaming chat REPL. Flags: `--model`, `--provider`, `--system` |
| `mantiq make:ai-tool <name>` | Generate an AgentTool class in `app/AI/Tools/` |

### Planned Commands

| Command | Description |
|---------|-------------|
| `mantiq ai:embed <file>` | Embed a file and output vectors |
| `mantiq ai:prompt:list` | List registered prompts and versions |
| `mantiq ai:cost:report` | Show usage report (tokens, cost, by model) |

---

## 16. Implementation Phases

### Phase 1 — Foundation (DONE)
- All contracts and types
- AIManager + PendingChat fluent builder
- NullDriver (default)
- AIServiceProvider
- Global `ai()` helper
- AIFake for testing
- AIError
- Package boilerplate (package.json, tsconfig.json, index.ts)

### Phase 2 — Provider Drivers (DONE)
- OpenAI (full: chat, stream, embed, image, TTS, STT, moderation)
- Anthropic (chat, stream, vision, tools)
- Gemini (chat, stream, embed, image, multimodal)
- Ollama (chat, stream, embed, vision)
- Azure OpenAI (delegates to OpenAI with Azure routing)
- Bedrock (chat, stream, embed, image, SigV4 signing)

### Phase 3 — RAG + Agents (DONE)
- TextSplitter (4 strategies)
- DocumentLoader (text, markdown, JSON, CSV)
- RAGPipeline (ingest → query)
- InMemoryVectorStore (cosine similarity)
- Agent loop with tool execution
- AgentTool base class
- BufferMemory, WindowMemory, SummaryMemory

### Phase 4 — Middleware + Observability + Guards (DONE)
- CostTrackingMiddleware with pricing table
- ContentModerationMiddleware
- PIIRedactionMiddleware
- UsageTracker
- ModelPolicy
- UsageQuota

### Phase 5 — Prompts + CLI (DONE)
- Prompt template engine
- PromptManager registry
- AIChatCommand
- MakeAIToolCommand

### Phase 6 — Extended (TODO)
- Additional vector stores: PgVectorStore, PineconeVectorStore, QdrantVectorStore, WeaviateVectorStore
- AI middleware pipeline integration into AIManager (pipe through middleware before driver calls)
- AI-powered ORM integration (NaturalLanguageQuery)
- Batch API support (OpenAI)
- Fine-tuning management
- Model listing / capabilities discovery
- Extended CLI commands (ai:embed, ai:prompt:list, ai:cost:report)
- Showcase page in example app

---

## 17. Dependencies

### Required
- `@mantiq/core` — ServiceProvider, ConfigRepository, MantiqError, Application

### Optional
- `@mantiq/cli` — Command, GeneratorCommand, registerCommands (for CLI)
- `@mantiq/database` — for PgVectorStore and ORM integration
- `@mantiq/queue` — for background embedding jobs

### External
- None. All HTTP calls use native `fetch()`. AWS SigV4 implemented via `crypto.subtle`.
