import type { AIManager } from '../AIManager.ts'
import type { VectorStore, VectorDocument } from '../contracts/VectorStore.ts'
import type { ChatResponse } from '../contracts/ChatMessage.ts'
import type { EmbedOptions } from '../contracts/Embedding.ts'
import { TextSplitter, type TextSplitterOptions } from './TextSplitter.ts'

export interface RAGOptions {
  topK?: number
  model?: string
  provider?: string
  embeddingModel?: string
  embeddingProvider?: string
  systemPrompt?: string
  splitter?: TextSplitterOptions
  minScore?: number
}

export interface RAGIngestResult {
  documentCount: number
  chunkCount: number
}

/**
 * RAG (Retrieval-Augmented Generation) pipeline.
 *
 * @example
 *   const rag = new RAGPipeline(ai(), vectorStore, {
 *     model: 'gpt-4o',
 *     topK: 5,
 *   })
 *   await rag.ingest([{ content: 'MantiqJS is a TypeScript framework...' }])
 *   const answer = await rag.query('What is MantiqJS?')
 */
export class RAGPipeline {
  private splitter: TextSplitter
  private topK: number
  private model: string | undefined
  private provider: string | undefined
  private embeddingProvider: string | undefined
  private embeddingModel: string | undefined
  private systemPrompt: string
  private minScore: number

  constructor(
    private manager: AIManager,
    private vectorStore: VectorStore,
    options?: RAGOptions,
  ) {
    this.splitter = new TextSplitter(options?.splitter)
    this.topK = options?.topK ?? 5
    this.model = options?.model ?? undefined
    this.provider = options?.provider ?? undefined
    this.embeddingProvider = options?.embeddingProvider ?? undefined
    this.embeddingModel = options?.embeddingModel ?? undefined
    this.systemPrompt = options?.systemPrompt ??
      'Answer the user\'s question based on the following context. If the context doesn\'t contain relevant information, say so.\n\nContext:\n{context}'
    this.minScore = options?.minScore ?? 0
  }

  /** Ingest documents into the vector store. */
  async ingest(documents: { content: string; metadata?: Record<string, any> }[]): Promise<RAGIngestResult> {
    const allChunks: { content: string; metadata: Record<string, any> }[] = []

    for (const doc of documents) {
      const chunks = this.splitter.split(doc.content)
      for (const chunk of chunks) {
        allChunks.push({ content: chunk, metadata: doc.metadata ?? {} })
      }
    }

    // Generate embeddings for all chunks
    const embedOptions: EmbedOptions = {}
    if (this.embeddingModel) embedOptions.model = this.embeddingModel
    const providerName = this.embeddingProvider ?? this.provider
    const driver = this.manager.driver(providerName)
    const embedResult = await driver.embed(allChunks.map((c) => c.content), embedOptions)

    // Upsert into vector store
    const vectorDocs: VectorDocument[] = allChunks.map((chunk, i) => ({
      id: crypto.randomUUID(),
      content: chunk.content,
      embedding: embedResult.embeddings[i]!,
      metadata: chunk.metadata,
    }))

    await this.vectorStore.upsert(vectorDocs)

    return { documentCount: documents.length, chunkCount: allChunks.length }
  }

  /** Query the RAG pipeline with a natural language question. */
  async query(question: string, options?: { systemPrompt?: string }): Promise<ChatResponse> {
    // 1. Embed the question
    const embedOptions: EmbedOptions = {}
    if (this.embeddingModel) embedOptions.model = this.embeddingModel
    const providerName = this.embeddingProvider ?? this.provider
    const driver = this.manager.driver(providerName)
    const embedResult = await driver.embed(question, embedOptions)
    const questionEmbedding = embedResult.embeddings[0]!

    // 2. Search the vector store
    const results = await this.vectorStore.search(questionEmbedding, {
      limit: this.topK,
      minScore: this.minScore,
    })

    // 3. Build context from results
    const context = results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n')

    // 4. Generate answer
    const systemPrompt = (options?.systemPrompt ?? this.systemPrompt).replace('{context}', context)

    const pending = this.manager.chat(this.model)
    if (this.provider) pending.via(this.provider)

    return pending
      .system(systemPrompt)
      .user(question)
      .send()
  }
}
