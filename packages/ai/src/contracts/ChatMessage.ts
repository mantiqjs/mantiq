// ── Roles & Messages ─────────────────────────────────────────────────────────

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ChatMessage {
  role: ChatRole
  content: string | ContentPart[]
  name?: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

// ── Multimodal Content ───────────────────────────────────────────────────────

export type ContentPart =
  | TextPart
  | ImageUrlPart
  | ImageBase64Part
  | AudioPart
  | VideoPart
  | FilePart

export interface TextPart {
  type: 'text'
  text: string
}

export interface ImageUrlPart {
  type: 'image_url'
  imageUrl: string
  detail?: 'auto' | 'low' | 'high'
}

export interface ImageBase64Part {
  type: 'image_base64'
  imageBase64: string
  mimeType: string
}

export interface AudioPart {
  type: 'audio'
  audioBase64: string
  mimeType: string
}

export interface VideoPart {
  type: 'video'
  videoUrl?: string
  videoBase64?: string
  mimeType: string
}

export interface FilePart {
  type: 'file'
  fileUrl?: string
  fileBase64?: string
  mimeType: string
  filename?: string
}

// ── Tool / Function Calling ──────────────────────────────────────────────────

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>  // JSON Schema
    strict?: boolean
  }
}

// ── Chat Options ─────────────────────────────────────────────────────────────

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
  tools?: ToolDefinition[]
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
  responseFormat?: ResponseFormat
  seed?: number
  user?: string
  metadata?: Record<string, any>
}

export type ResponseFormat =
  | 'text'
  | 'json'
  | { type: 'json_schema'; schema: Record<string, any>; name?: string; strict?: boolean }

// ── Chat Response ────────────────────────────────────────────────────────────

export interface ChatResponse {
  id: string
  content: string
  role: 'assistant'
  model: string
  toolCalls: ToolCall[]
  usage: TokenUsage
  finishReason: FinishReason
  raw: any
}

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error'

export interface ChatChunk {
  id: string
  delta: string
  toolCalls?: ToolCall[] | undefined
  finishReason?: FinishReason | undefined
  usage?: TokenUsage | undefined
}

// ── Token Usage ──────────────────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}
