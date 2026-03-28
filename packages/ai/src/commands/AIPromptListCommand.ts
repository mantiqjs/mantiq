import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { Application } from '@mantiq/core'
import { PromptManager } from '../prompts/PromptManager.ts'

/**
 * List all registered prompts from PromptManager.
 *
 * Usage: bun mantiq ai:prompt:list
 */
export class AIPromptListCommand extends Command {
  override name = 'ai:prompt:list'
  override description = 'List all registered prompt templates'
  override usage = 'ai:prompt:list'

  override async handle(_args: ParsedArgs): Promise<number> {
    const manager = Application.getInstance().make(PromptManager)
    const prompts = manager.list()

    if (prompts.length === 0) {
      this.io.info('No prompts registered.')
      return 0
    }

    const rows = prompts.map((p) => {
      const preview = p.template.length > 80
        ? p.template.slice(0, 80) + '...'
        : p.template
      return [p.name, p.version, preview]
    })

    this.io.heading('Registered Prompts')
    this.io.table(['Name', 'Version', 'Template'], rows)
    this.io.newLine()

    return 0
  }
}
