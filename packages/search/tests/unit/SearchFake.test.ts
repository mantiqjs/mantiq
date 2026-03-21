import { describe, it, expect, beforeEach } from 'bun:test'
import { SearchFake } from '../../src/testing/SearchFake.ts'

function createModel(id: number, attrs: Record<string, any> = {}) {
  return {
    id,
    attributes: { id, ...attrs },
    getAttribute(key: string) { return this.attributes[key] },
    toSearchableArray() { return { ...this.attributes } },
    searchableKey() { return this.id },
    constructor: MockModel,
  }
}

class MockModel {
  static table = 'posts'
  static searchableAs() { return 'posts' }
}

describe('SearchFake', () => {
  let fake: SearchFake

  beforeEach(() => {
    fake = new SearchFake()
  })

  it('tracks indexed models', async () => {
    await fake.update([createModel(1), createModel(2)])
    fake.assertIndexed(MockModel, 2)
  })

  it('tracks deleted models', async () => {
    const m = createModel(1)
    await fake.update([m])
    await fake.delete([m])
    fake.assertDeleted(MockModel, 1)
  })

  it('tracks flushed indices', async () => {
    await fake.update([createModel(1)])
    await fake.flush('posts')
    fake.assertFlushed(MockModel)
  })

  it('assertNothingIndexed passes when empty', () => {
    fake.assertNothingIndexed()
  })

  it('assertNothingIndexed throws when indexed', async () => {
    await fake.update([createModel(1)])
    expect(() => fake.assertNothingIndexed()).toThrow()
  })

  it('assertNotIndexed passes when empty', () => {
    fake.assertNotIndexed(MockModel)
  })

  it('assertNotIndexed throws when indexed', async () => {
    await fake.update([createModel(1)])
    expect(() => fake.assertNotIndexed(MockModel)).toThrow()
  })

  it('getIndexed returns indexed records', async () => {
    await fake.update([createModel(1, { title: 'Hello' })])
    const records = fake.getIndexed(MockModel)
    expect(records.size).toBe(1)
    expect(records.get(1)?.title).toBe('Hello')
  })

  it('reset clears everything', async () => {
    await fake.update([createModel(1)])
    await fake.delete([createModel(2)])
    await fake.flush('posts')

    fake.reset()
    fake.assertNothingIndexed()
  })
})
