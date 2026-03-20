/**
 * Lightweight argument parser for CLI commands.
 * Parses process.argv into command name, positional args, and flags.
 *
 * @example
 *   // bun mantiq make:model User -m --table=users
 *   parse(['make:model', 'User', '-m', '--table=users'])
 *   // => { command: 'make:model', args: ['User'], flags: { m: true, table: 'users' } }
 */

export interface ParsedArgs {
  /** The command name (e.g. 'migrate', 'make:model') */
  command: string
  /** Positional arguments after the command */
  args: string[]
  /** Named flags — boolean for switches, string for --key=value */
  flags: Record<string, string | boolean>
}

export function parse(argv: string[]): ParsedArgs {
  // Skip bun/node executable and script path
  const raw = argv.slice(2)

  const command = raw[0] ?? 'help'
  const args: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let i = 1; i < raw.length; i++) {
    const arg = raw[i]!

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1)
      } else {
        // Check if next arg is the value (not another flag)
        const key = arg.slice(2)
        const next = raw[i + 1]
        if (next && !next.startsWith('-')) {
          flags[key] = next
          i++
        } else {
          flags[key] = true
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flag: -m, -f, -p 8080, etc.
      const key = arg[1]!
      const next = raw[i + 1]
      if (next && !next.startsWith('-')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      args.push(arg)
    }
  }

  return { command, args, flags }
}
