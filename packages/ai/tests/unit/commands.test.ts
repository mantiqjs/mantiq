import { describe, it, expect } from 'bun:test'
import { AIChatCommand } from '../../src/commands/AIChatCommand.ts'
import { MakeAIToolCommand } from '../../src/commands/MakeAIToolCommand.ts'
import { AIEmbedCommand } from '../../src/commands/AIEmbedCommand.ts'
import { AIPromptListCommand } from '../../src/commands/AIPromptListCommand.ts'
import { AICostReportCommand } from '../../src/commands/AICostReportCommand.ts'

describe('AIChatCommand', () => {
  const cmd = new AIChatCommand()

  it('has correct name', () => {
    expect(cmd.name).toBe('ai:chat')
  })

  it('has a description', () => {
    expect(cmd.description).toBeTruthy()
  })

  it('has usage info', () => {
    expect(cmd.usage).toContain('ai:chat')
  })
})

describe('MakeAIToolCommand', () => {
  const cmd = new MakeAIToolCommand()

  it('has correct name', () => {
    expect(cmd.name).toBe('make:ai-tool')
  })

  it('has a description', () => {
    expect(cmd.description).toBeTruthy()
  })

  it('has usage info', () => {
    expect(cmd.usage).toContain('make:ai-tool')
  })
})

describe('AIEmbedCommand', () => {
  const cmd = new AIEmbedCommand()

  it('has correct name', () => {
    expect(cmd.name).toBe('ai:embed')
  })

  it('has a description', () => {
    expect(cmd.description).toBeTruthy()
  })

  it('has usage info', () => {
    expect(cmd.usage).toContain('ai:embed')
    expect(cmd.usage).toContain('--model')
    expect(cmd.usage).toContain('--dimensions')
  })

  it('returns 1 when no file path provided', async () => {
    const code = await cmd.handle({ command: 'ai:embed', args: [], flags: {} })
    expect(code).toBe(1)
  })

  it('returns 1 when file does not exist', async () => {
    const code = await cmd.handle({ command: 'ai:embed', args: ['/tmp/__nonexistent_embed_test__'], flags: {} })
    expect(code).toBe(1)
  })
})

describe('AIPromptListCommand', () => {
  const cmd = new AIPromptListCommand()

  it('has correct name', () => {
    expect(cmd.name).toBe('ai:prompt:list')
  })

  it('has a description', () => {
    expect(cmd.description).toBeTruthy()
  })

  it('has usage info', () => {
    expect(cmd.usage).toContain('ai:prompt:list')
  })
})

describe('AICostReportCommand', () => {
  const cmd = new AICostReportCommand()

  it('has correct name', () => {
    expect(cmd.name).toBe('ai:cost:report')
  })

  it('has a description', () => {
    expect(cmd.description).toBeTruthy()
  })

  it('has usage info', () => {
    expect(cmd.usage).toContain('ai:cost:report')
    expect(cmd.usage).toContain('--since')
  })
})
