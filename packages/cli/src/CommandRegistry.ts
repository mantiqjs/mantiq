import type { Command } from './Command.ts'

/**
 * Global command registry. Service providers push their commands here
 * during boot(), and the CLI Kernel collects them at run time.
 *
 * This decouples command registration from the Kernel — each package
 * registers its own commands without the user needing to import them.
 */

const _commands: Command[] = []

export function registerCommand(command: Command): void {
  _commands.push(command)
}

export function registerCommands(commands: Command[]): void {
  for (const cmd of commands) _commands.push(cmd)
}

export function getRegisteredCommands(): Command[] {
  return [..._commands]
}

export function clearRegisteredCommands(): void {
  _commands.length = 0
}
