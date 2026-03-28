import { describe, it, expect } from 'bun:test'
import { NullDriver } from '../../src/drivers/NullDriver.ts'

describe('NullDriver', () => {
  const driver = new NullDriver()

  it('chat() returns empty content with assistant role', async () => {
    const response = await driver.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('')
    expect(response.role).toBe('assistant')
    expect(response.model).toBe('null')
    expect(response.toolCalls).toEqual([])
    expect(response.finishReason).toBe('stop')
    expect(response.usage.promptTokens).toBe(0)
    expect(response.usage.completionTokens).toBe(0)
    expect(response.usage.totalTokens).toBe(0)
    expect(response.id).toBeTruthy()
    expect(response.raw).toBeNull()
  })

  it('stream() yields no chunks', async () => {
    const chunks: any[] = []
    for await (const chunk of driver.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk)
    }
    expect(chunks).toHaveLength(0)
  })

  it('embed() returns empty embedding vectors for single input', async () => {
    const result = await driver.embed('Hello')
    expect(result.embeddings).toHaveLength(1)
    expect(result.embeddings[0]).toEqual([])
    expect(result.model).toBe('null')
    expect(result.usage.totalTokens).toBe(0)
  })

  it('embed() returns empty embedding vectors for array input', async () => {
    const result = await driver.embed(['Hello', 'World', 'Test'])
    expect(result.embeddings).toHaveLength(3)
    result.embeddings.forEach((emb) => expect(emb).toEqual([]))
  })

  it('generateImage() returns empty images array', async () => {
    const result = await driver.generateImage('A cat')
    expect(result.images).toEqual([])
    expect(result.model).toBe('null')
  })

  it('speak() returns empty Uint8Array', async () => {
    const result = await driver.speak('Hello world')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(0)
  })

  it('transcribe() returns empty text', async () => {
    const result = await driver.transcribe(new Uint8Array([1, 2, 3]))
    expect(result.text).toBe('')
  })

  it('moderate() returns empty results array', async () => {
    const result = await driver.moderate('Some content')
    expect(result.results).toEqual([])
    expect(result.id).toBeTruthy()
  })

  it('makes no API calls (all methods are synchronous no-ops)', async () => {
    // Verify all methods resolve without external calls by running them all
    const [chat, embed, image, speech, transcription, moderation] = await Promise.all([
      driver.chat([{ role: 'user', content: 'test' }]),
      driver.embed('test'),
      driver.generateImage('test'),
      driver.speak('test'),
      driver.transcribe(new Uint8Array()),
      driver.moderate('test'),
    ])

    expect(chat.content).toBe('')
    expect(embed.embeddings).toHaveLength(1)
    expect(image.images).toEqual([])
    expect(speech.length).toBe(0)
    expect(transcription.text).toBe('')
    expect(moderation.results).toEqual([])
  })
})
