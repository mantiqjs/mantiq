/**
 * Dump values to console and die (exit process).
 * Laravel's dd() equivalent.
 *
 * @example dd(user)
 * @example dd(user, request.query(), 'debug')
 */
export function dd(...args: any[]): never {
  dump(...args)
  process.exit(1)
}

/**
 * Dump values to console with colorized, inspected output.
 * Like dd() but doesn't exit.
 *
 * @example dump(user)
 * @example dump(user, request.query())
 */
export function dump(...args: any[]): void {
  for (const arg of args) {
    if (arg === null) {
      console.log('\x1b[2mnull\x1b[0m')
    } else if (arg === undefined) {
      console.log('\x1b[2mundefined\x1b[0m')
    } else if (typeof arg === 'string') {
      console.log(`\x1b[32m"${arg}"\x1b[0m`)
    } else if (typeof arg === 'number' || typeof arg === 'bigint') {
      console.log(`\x1b[33m${arg}\x1b[0m`)
    } else if (typeof arg === 'boolean') {
      console.log(`\x1b[35m${arg}\x1b[0m`)
    } else if (arg instanceof Error) {
      console.log(`\x1b[31m${arg.constructor.name}: ${arg.message}\x1b[0m`)
      if (arg.stack) {
        const frames = arg.stack.split('\n').slice(1, 6).map(l => `  \x1b[2m${l.trim()}\x1b[0m`)
        console.log(frames.join('\n'))
      }
    } else if (Array.isArray(arg)) {
      console.dir(arg, { depth: 4, colors: true })
    } else if (typeof arg === 'object') {
      // Model instances — use toObject() if available
      if (typeof arg.toObject === 'function') {
        console.log(`\x1b[36m${arg.constructor?.name ?? 'Object'}\x1b[0m`)
        console.dir(arg.toObject(), { depth: 4, colors: true })
      } else {
        console.dir(arg, { depth: 4, colors: true })
      }
    } else {
      console.log(arg)
    }
  }
}
