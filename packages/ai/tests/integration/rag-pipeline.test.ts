/**
 * End-to-end RAG pipeline test using Ollama (free, local).
 *
 * Tests the full flow: load docs → split → embed → upsert → query → generate answer.
 * Requires Ollama with tinyllama and all-minilm models.
 */
import { describe, it, expect, beforeAll } from 'bun:test'
import { AIManager } from '../../src/AIManager.ts'
import { RAGPipeline } from '../../src/rag/RAGPipeline.ts'
import { InMemoryVectorStore } from '../../src/vectorStores/InMemoryVectorStore.ts'
import { TextSplitter } from '../../src/rag/TextSplitter.ts'
import { DocumentLoader } from '../../src/rag/DocumentLoader.ts'

const OLLAMA_HOST = process.env['OLLAMA_HOST'] ?? 'http://localhost'
const OLLAMA_PORT = Number(process.env['OLLAMA_PORT'] ?? '11434')
const CHAT_MODEL = process.env['OLLAMA_CHAT_MODEL'] ?? 'tinyllama'
const EMBED_MODEL = process.env['OLLAMA_EMBED_MODEL'] ?? 'all-minilm'

let available = false

beforeAll(async () => {
  if (process.env['SKIP_OLLAMA'] === '1') return
  try {
    const res = await fetch(`${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, { signal: AbortSignal.timeout(3000) })
    available = res.ok
  } catch {
    available = false
  }
})

describe('RAG Pipeline Integration', () => {
  it.skipIf(!available)('full pipeline: ingest → query', async () => {
    const manager = new AIManager({
      default: 'ollama',
      providers: {
        ollama: { driver: 'ollama', host: OLLAMA_HOST, port: OLLAMA_PORT },
      },
    })

    const vectorStore = new InMemoryVectorStore()
    const rag = new RAGPipeline(manager, vectorStore, {
      model: CHAT_MODEL,
      embeddingModel: EMBED_MODEL,
      topK: 2,
      splitter: { chunkSize: 200, chunkOverlap: 50 },
    })

    // Ingest some documents
    const result = await rag.ingest([
      { content: 'MantiqJS is a TypeScript web framework for Bun. It uses service providers and an IoC container.', metadata: { source: 'docs' } },
      { content: 'Python is a programming language known for data science and machine learning applications.', metadata: { source: 'wiki' } },
      { content: 'The MantiqJS router supports Express-like syntax with route groups and middleware.', metadata: { source: 'docs' } },
    ])

    expect(result.documentCount).toBe(3)
    expect(result.chunkCount).toBeGreaterThanOrEqual(3)
    expect(await vectorStore.count()).toBe(result.chunkCount)

    // Query — should retrieve MantiqJS docs and generate a relevant answer
    const answer = await rag.query('What is MantiqJS?')

    expect(answer.content.length).toBeGreaterThan(0)
    // The answer should reference something from the ingested docs
    expect(answer.content.toLowerCase()).toMatch(/typescript|framework|bun|mantiq/i)
  }, 120_000)

  it.skipIf(!available)('TextSplitter + DocumentLoader work together', async () => {
    const loader = new DocumentLoader()
    const docs = loader.fromString(
      'Section 1: MantiqJS uses TypeScript.\n\nSection 2: It runs on Bun.\n\nSection 3: It has an IoC container.',
      { source: 'test' },
    )

    const splitter = new TextSplitter({ chunkSize: 60, chunkOverlap: 0 })
    const chunks = splitter.split(docs[0]!.content)

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(docs[0]!.metadata.source).toBe('test')
  })
})
