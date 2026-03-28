import { describe, it, expect, afterEach } from 'bun:test'
import { DocumentLoader } from '../../src/rag/DocumentLoader.ts'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

describe('DocumentLoader', () => {
  const loader = new DocumentLoader()
  let tmpDir: string

  // Create a fresh temp directory before tests and track for cleanup
  const dirs: string[] = []

  async function makeTmpDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'mantiq-doc-loader-'))
    dirs.push(dir)
    return dir
  }

  afterEach(async () => {
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
    dirs.length = 0
  })

  // ── loadText ───────────────────────────────────────────────────────────────

  it('loadText loads a plain text file', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'sample.txt')
    await Bun.write(filePath, 'Hello, world!')

    const docs = await loader.loadText(filePath)
    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('Hello, world!')
    expect(docs[0]!.metadata.source).toBe(filePath)
    expect(docs[0]!.metadata.type).toBe('text')
  })

  it('loadText preserves multi-line content', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'multi.txt')
    const content = 'Line one\nLine two\nLine three'
    await Bun.write(filePath, content)

    const docs = await loader.loadText(filePath)
    expect(docs[0]!.content).toBe(content)
  })

  // ── loadMarkdown ───────────────────────────────────────────────────────────

  it('loadMarkdown loads a markdown file', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'readme.md')
    const md = '# Title\n\nParagraph text.\n\n## Section\n\nMore content.'
    await Bun.write(filePath, md)

    const docs = await loader.loadMarkdown(filePath)
    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe(md)
    expect(docs[0]!.metadata.source).toBe(filePath)
    expect(docs[0]!.metadata.type).toBe('markdown')
  })

  // ── loadJson ───────────────────────────────────────────────────────────────

  it('loadJson loads a single JSON object', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'data.json')
    const obj = { name: 'Alice', age: 30 }
    await Bun.write(filePath, JSON.stringify(obj))

    const docs = await loader.loadJson(filePath)
    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe(JSON.stringify(obj))
    expect(docs[0]!.metadata.type).toBe('json')
  })

  it('loadJson extracts a specific content field', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'data.json')
    await Bun.write(filePath, JSON.stringify({ title: 'Post', body: 'Content here' }))

    const docs = await loader.loadJson(filePath, 'body')
    expect(docs[0]!.content).toBe('Content here')
  })

  it('loadJson loads a JSON array', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'items.json')
    const items = [
      { text: 'First item' },
      { text: 'Second item' },
      { text: 'Third item' },
    ]
    await Bun.write(filePath, JSON.stringify(items))

    const docs = await loader.loadJson(filePath)
    expect(docs).toHaveLength(3)
    expect(docs[0]!.metadata.index).toBe(0)
    expect(docs[1]!.metadata.index).toBe(1)
    expect(docs[2]!.metadata.index).toBe(2)
  })

  it('loadJson with contentField on array extracts per-item', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'items.json')
    const items = [
      { text: 'Alpha' },
      { text: 'Beta' },
    ]
    await Bun.write(filePath, JSON.stringify(items))

    const docs = await loader.loadJson(filePath, 'text')
    expect(docs[0]!.content).toBe('Alpha')
    expect(docs[1]!.content).toBe('Beta')
  })

  // ── loadCsv ────────────────────────────────────────────────────────────────

  it('loadCsv loads rows as documents', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'data.csv')
    const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA'
    await Bun.write(filePath, csv)

    const docs = await loader.loadCsv(filePath)
    expect(docs).toHaveLength(2)
    expect(docs[0]!.content).toBe('Alice 30 NYC')
    expect(docs[0]!.metadata.type).toBe('csv')
    expect(docs[0]!.metadata.row).toBe(1)
    expect(docs[0]!.metadata.name).toBe('Alice')
    expect(docs[1]!.content).toBe('Bob 25 LA')
  })

  it('loadCsv with contentColumns selects specific columns', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'data.csv')
    const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA'
    await Bun.write(filePath, csv)

    const docs = await loader.loadCsv(filePath, ['name', 'city'])
    expect(docs[0]!.content).toBe('Alice NYC')
    expect(docs[1]!.content).toBe('Bob LA')
  })

  it('loadCsv returns empty for header-only file', async () => {
    const dir = await makeTmpDir()
    const filePath = join(dir, 'empty.csv')
    await Bun.write(filePath, 'name,age,city\n')

    const docs = await loader.loadCsv(filePath)
    expect(docs).toHaveLength(0)
  })

  // ── fromString ─────────────────────────────────────────────────────────────

  it('fromString creates a document from raw content', () => {
    const docs = loader.fromString('Some inline text')
    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('Some inline text')
    expect(docs[0]!.metadata.source).toBe('string')
    expect(docs[0]!.metadata.type).toBe('text')
  })

  it('fromString merges custom metadata', () => {
    const docs = loader.fromString('Data', { customKey: 'customValue' })
    expect(docs[0]!.metadata.customKey).toBe('customValue')
    expect(docs[0]!.metadata.source).toBe('string')
  })
})
