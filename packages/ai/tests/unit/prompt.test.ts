import { describe, it, expect } from 'bun:test'
import { Prompt } from '../../src/prompts/Prompt.ts'
import { PromptManager } from '../../src/prompts/PromptManager.ts'

describe('Prompt', () => {
  it('renders variables', () => {
    const prompt = new Prompt('Hello {{name}}, welcome to {{place}}!')
    const rendered = prompt.with({ name: 'Alice', place: 'Wonderland' }).render()
    expect(rendered).toBe('Hello Alice, welcome to Wonderland!')
  })

  it('preserves unset variables', () => {
    const prompt = new Prompt('Hello {{name}}, your role is {{role}}.')
    const rendered = prompt.with({ name: 'Bob' }).render()
    expect(rendered).toBe('Hello Bob, your role is {{role}}.')
  })

  it('extracts variable names', () => {
    const prompt = new Prompt('{{greeting}} {{name}}, your code is {{code}}. {{name}} again.')
    const vars = prompt.getVariableNames()
    expect(vars).toContain('greeting')
    expect(vars).toContain('name')
    expect(vars).toContain('code')
    // Should deduplicate
    expect(vars.filter((v) => v === 'name')).toHaveLength(1)
  })

  it('returns template and version', () => {
    const prompt = new Prompt('template here', {}, '2.1')
    expect(prompt.getTemplate()).toBe('template here')
    expect(prompt.getVersion()).toBe('2.1')
  })

  it('chains .with() calls', () => {
    const prompt = new Prompt('{{a}} and {{b}}')
    const rendered = prompt.with({ a: 'X' }).with({ b: 'Y' }).render()
    expect(rendered).toBe('X and Y')
  })
})

describe('PromptManager', () => {
  it('registers and retrieves prompts', () => {
    const manager = new PromptManager()
    manager.register('greet', new Prompt('Hello {{name}}', {}, '1.0'))
    const prompt = manager.get('greet')
    expect(prompt.getVersion()).toBe('1.0')
  })

  it('returns latest version by default', () => {
    const manager = new PromptManager()
    manager.register('greet', new Prompt('Hi {{name}}', {}, '1.0'))
    manager.register('greet', new Prompt('Hello {{name}}', {}, '2.0'))
    expect(manager.get('greet').getVersion()).toBe('2.0')
  })

  it('retrieves specific version', () => {
    const manager = new PromptManager()
    manager.register('greet', new Prompt('Hi {{name}}', {}, '1.0'))
    manager.register('greet', new Prompt('Hello {{name}}', {}, '2.0'))
    expect(manager.get('greet', '1.0').getTemplate()).toBe('Hi {{name}}')
  })

  it('throws for unknown prompt', () => {
    const manager = new PromptManager()
    expect(() => manager.get('nope')).toThrow('not found')
  })

  it('throws for unknown version', () => {
    const manager = new PromptManager()
    manager.register('greet', new Prompt('Hi', {}, '1.0'))
    expect(() => manager.get('greet', '9.9')).toThrow('not found')
  })

  it('lists all prompts', () => {
    const manager = new PromptManager()
    manager.register('a', new Prompt('A1', {}, '1.0'))
    manager.register('a', new Prompt('A2', {}, '2.0'))
    manager.register('b', new Prompt('B1', {}, '1.0'))
    const list = manager.list()
    expect(list).toHaveLength(3)
  })

  it('checks existence', () => {
    const manager = new PromptManager()
    expect(manager.has('greet')).toBe(false)
    manager.register('greet', new Prompt('Hi'))
    expect(manager.has('greet')).toBe(true)
  })

  it('removes prompts', () => {
    const manager = new PromptManager()
    manager.register('greet', new Prompt('Hi'))
    manager.remove('greet')
    expect(manager.has('greet')).toBe(false)
  })
})
