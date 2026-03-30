import { AgentGenerateCommand } from './AgentGenerateCommand.ts'

/**
 * Alias for agent:generate — regenerates AI agent context files.
 * Useful after installing or removing @mantiq/* packages.
 */
export class AgentUpdateCommand extends AgentGenerateCommand {
  override name = 'agent:update'
  override description = 'Regenerate AI agent context files (alias for agent:generate)'
}
