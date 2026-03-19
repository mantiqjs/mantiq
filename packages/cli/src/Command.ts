import { IO } from './IO.ts'
import type { ParsedArgs } from './Parser.ts'

/**
 * Base class for all CLI commands.
 */
export abstract class Command {
  /** Command name, e.g. 'migrate', 'make:model' */
  abstract name: string

  /** Short description shown in help */
  abstract description: string

  /** Usage hint, e.g. 'make:model <name> [--migration]' */
  usage?: string

  protected io = new IO()

  /**
   * Execute the command.
   * @returns exit code (0 = success)
   */
  abstract handle(args: ParsedArgs): Promise<number>
}
