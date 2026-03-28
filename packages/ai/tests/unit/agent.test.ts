import { describe, it, expect } from 'bun:test'
import { Agent } from '../../src/agents/Agent.ts'
import { AgentTool } from '../../src/agents/AgentTool.ts'
import { AIManager } from '../../src/AIManager.ts'
import { AIFake } from '../../src/testing/AIFake.ts'
import type { ChatResponse } from '../../src/contracts/ChatMessage.ts'

class CalculatorTool extends AgentTool {
  override name = 'calculator'
  override description = 'Perform math calculations'
  override parameters = {
    type: 'object',
    properties: { expression: { type: 'string' } },
    required: ['expression'],
  }

  override async execute(args: Record<string, any>): Promise<string> {
    // eslint-disable-next-line no-eval -- test only
    return String(eval(args['expression']))
  }
}

class FailingTool extends AgentTool {
  override name = 'failing_tool'
  override description = 'Always fails'
  override parameters = { type: 'object', properties: {} }

  override async execute(): Promise<string> {
    throw new Error('Tool broke')
  }
}

function makeManager(fake: AIFake): AIManager {
  const manager = new AIManager({ default: 'fake', providers: {} })
  manager.extend('fake', () => fake)
  return manager
}

function makeToolCallResponse(toolName: string, args: Record<string, any>): Partial<ChatResponse> {
  return {
    content: '',
    finishReason: 'tool_calls',
    toolCalls: [{
      id: 'call_1',
      type: 'function',
      function: { name: toolName, arguments: JSON.stringify(args) },
    }],
  }
}

describe('Agent', () => {
  it('runs a simple chat without tools', async () => {
    const fake = new AIFake()
    fake.respondWith({ content: 'Hello!' })

    const agent = new Agent(makeManager(fake))
    const result = await agent.run('Hi')

    expect(result.content).toBe('Hello!')
    expect(result.iterations).toBe(1)
    expect(result.toolCallsExecuted).toHaveLength(0)
  })

  it('executes tools and feeds results back', async () => {
    const fake = new AIFake()
    fake.respondWithSequence([
      makeToolCallResponse('calculator', { expression: '2 + 3' }),
      { content: 'The answer is 5.' },
    ])

    const agent = new Agent(makeManager(fake))
    agent.addTool(new CalculatorTool())

    const result = await agent.run('What is 2 + 3?')

    expect(result.content).toBe('The answer is 5.')
    expect(result.iterations).toBe(2)
    expect(result.toolCallsExecuted).toHaveLength(1)
    expect(result.toolCallsExecuted[0]!.name).toBe('calculator')
    expect(result.toolCallsExecuted[0]!.result).toBe('5')
  })

  it('handles tool errors gracefully', async () => {
    const fake = new AIFake()
    fake.respondWithSequence([
      makeToolCallResponse('failing_tool', {}),
      { content: 'Sorry, the tool failed.' },
    ])

    const agent = new Agent(makeManager(fake))
    agent.addTool(new FailingTool())

    const result = await agent.run('Do the thing')

    expect(result.toolCallsExecuted[0]!.result).toContain('Error executing tool')
    expect(result.content).toBe('Sorry, the tool failed.')
  })

  it('handles unknown tool calls', async () => {
    const fake = new AIFake()
    fake.respondWithSequence([
      makeToolCallResponse('nonexistent', {}),
      { content: 'Tool not found.' },
    ])

    const agent = new Agent(makeManager(fake))
    const result = await agent.run('Use nonexistent tool')

    expect(result.toolCallsExecuted[0]!.result).toContain('Unknown tool')
  })

  it('respects maxIterations', async () => {
    const fake = new AIFake()
    // Always returns tool calls — never stops
    fake.respondWith(makeToolCallResponse('calculator', { expression: '1+1' }))

    const agent = new Agent(makeManager(fake), { maxIterations: 3 })
    agent.addTool(new CalculatorTool())

    await expect(agent.run('Loop forever')).rejects.toThrow('maximum iterations')
  })

  it('calls onToolCall callback', async () => {
    const fake = new AIFake()
    fake.respondWithSequence([
      makeToolCallResponse('calculator', { expression: '10*2' }),
      { content: '20' },
    ])

    const calls: { name: string; args: Record<string, any> }[] = []
    const agent = new Agent(makeManager(fake), {
      onToolCall: (name, args) => calls.push({ name, args }),
    })
    agent.addTool(new CalculatorTool())
    await agent.run('Calculate')

    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('calculator')
  })

  it('uses system prompt', async () => {
    const fake = new AIFake()
    fake.respondWith({ content: 'OK' })

    const agent = new Agent(makeManager(fake), { systemPrompt: 'You are a math tutor.' })
    await agent.run('Help me')

    const sent = fake.sent()[0]!
    expect(sent.messages![0]!.role).toBe('system')
    expect(sent.messages![0]!.content).toBe('You are a math tutor.')
  })

  it('toDefinition() on AgentTool', () => {
    const tool = new CalculatorTool()
    const def = tool.toDefinition()
    expect(def.type).toBe('function')
    expect(def.function.name).toBe('calculator')
    expect(def.function.description).toBe('Perform math calculations')
  })

  it('tracks total tokens', async () => {
    const fake = new AIFake()
    fake.respondWithSequence([
      { ...makeToolCallResponse('calculator', { expression: '1' }), usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      { content: 'Done', usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 } },
    ])

    const agent = new Agent(makeManager(fake))
    agent.addTool(new CalculatorTool())
    const result = await agent.run('Calculate')

    expect(result.totalTokens).toBe(45)
  })
})
