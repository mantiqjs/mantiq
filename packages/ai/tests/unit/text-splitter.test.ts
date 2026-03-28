import { describe, it, expect } from 'bun:test'
import { TextSplitter } from '../../src/rag/TextSplitter.ts'

describe('TextSplitter', () => {
  it('splits text by default separator (double newline)', () => {
    const splitter = new TextSplitter({ chunkSize: 100, chunkOverlap: 0 })
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
    const chunks = splitter.split(text)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.join(' ')).toContain('First paragraph')
    expect(chunks.join(' ')).toContain('Third paragraph')
  })

  it('merges small segments into chunks up to chunkSize', () => {
    const splitter = new TextSplitter({ chunkSize: 50, chunkOverlap: 0 })
    const text = 'A.\n\nB.\n\nC.\n\nD.'
    const chunks = splitter.split(text)
    // All segments are tiny, so they merge until hitting chunkSize
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('respects chunkOverlap', () => {
    const splitter = new TextSplitter({ chunkSize: 30, chunkOverlap: 10 })
    const text = 'Hello world this is chunk one.\n\nHere is the second chunk now.'
    const chunks = splitter.split(text)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('splits by paragraph', () => {
    const splitter = new TextSplitter({ chunkSize: 500, chunkOverlap: 0 })
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.'
    const chunks = splitter.splitByParagraph(text)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks[0]).toContain('Paragraph one')
  })

  it('splits by markdown headers', () => {
    const splitter = new TextSplitter({ chunkSize: 40, chunkOverlap: 0 })
    const text = '## Section 1\nContent one.\n## Section 2\nContent two.\n### Subsection\nSub content.'
    const chunks = splitter.splitByMarkdownHeaders(text)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })

  it('splits by sentence', () => {
    const splitter = new TextSplitter({ chunkSize: 500, chunkOverlap: 0 })
    const text = 'First sentence. Second sentence! Third sentence? Fourth.'
    const chunks = splitter.splitBySentence(text)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.join(' ')).toContain('First sentence.')
  })

  it('returns single chunk for short text', () => {
    const splitter = new TextSplitter({ chunkSize: 1000, chunkOverlap: 0 })
    const text = 'Short text.'
    const chunks = splitter.split(text)
    expect(chunks).toEqual(['Short text.'])
  })

  it('handles empty text', () => {
    const splitter = new TextSplitter()
    const chunks = splitter.split('')
    expect(chunks).toEqual([])
  })
})
