import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { Application } from '@mantiq/core'
import { AIManager } from '../AIManager.ts'
import type { ChatMessage } from '../contracts/ChatMessage.ts'

/**
 * Interactive AI chat session in the terminal.
 *
 * Usage: bun mantiq ai:chat [--provider=openai] [--model=gpt-4o]
 */
export class AIChatCommand extends Command {
  override name = 'ai:chat'
  override description = 'Start an interactive AI chat session'
  override usage = 'ai:chat [--provider=<name>] [--model=<model>] [--system=<prompt>]'

  override async handle(args: ParsedArgs): Promise<number> {
    const provider = args.flags['provider'] as string | undefined
    const model = (args.flags['model'] as string | undefined) ?? 'gpt-4o'
    const systemPrompt = args.flags['system'] as string | undefined

    const manager = Application.getInstance().make(AIManager)
    const messages: ChatMessage[] = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    this.io.info(`AI Chat — model: ${model}, provider: ${provider ?? 'default'}`)
    this.io.info('Type "exit" or Ctrl+C to quit.\n')

    const readline = await import('readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    const prompt = (): Promise<string> =>
      new Promise((resolve) => rl.question('You: ', resolve))

    while (true) {
      const input = await prompt()
      if (input.trim().toLowerCase() === 'exit') break

      messages.push({ role: 'user', content: input })

      process.stdout.write('\nAssistant: ')

      const pending = manager.chat(model)
      if (provider) pending.via(provider)

      let fullContent = ''
      for await (const chunk of pending.messages(messages).stream()) {
        process.stdout.write(chunk.delta)
        fullContent += chunk.delta
      }
      process.stdout.write('\n\n')

      messages.push({ role: 'assistant', content: fullContent })
    }

    rl.close()
    return 0
  }
}
