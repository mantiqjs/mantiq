/**
 * Interactive terminal UI — zero deps, raw ANSI + Bun stdin.
 * Styled with emerald accent and box-drawing characters.
 */

const ESC = '\x1b['
const R = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const EMERALD = '\x1b[38;2;52;211;153m'
const GRAY = '\x1b[90m'
const RED = '\x1b[31m'
const WHITE = '\x1b[37m'
const HIDE_CURSOR = `${ESC}?25l`
const SHOW_CURSOR = `${ESC}?25h`
const CLEAR_LINE = `${ESC}2K`
const UP = (n: number) => `${ESC}${n}A`

function write(s: string) { process.stdout.write(s) }

export interface SelectOption {
  value: string
  label: string
  hint?: string
}

export class Terminal {
  /** Show branded ASCII header */
  header(): void {
    write('\n\n')
    write(`   ${EMERALD}▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇${R}\n`)
    write(`\n`)
    write(`   ${EMERALD}●${R}  ${BOLD}mantiq${R}   ${GRAY}│${R}   ${DIM}The Bun framework for artisans${R}\n`)
    write(`\n`)
    write(`   ${GRAY}───────────────────────────────────────────────${R}\n`)
    const version = require('../package.json').version
    write(`   ${DIM}v${version}${R}\n`)
    write('\n\n')
  }

  /** Arrow-key select prompt */
  async select(label: string, options: SelectOption[]): Promise<string> {
    let selected = 0
    const render = () => {
      let out = `   ${EMERALD}◆${R}  ${BOLD}${label}${R}\n`
      for (let i = 0; i < options.length; i++) {
        const opt = options[i]!
        const active = i === selected
        const bullet = active ? `${EMERALD}●${R}` : `${GRAY}○${R}`
        const text = active ? `${WHITE}${BOLD}${opt.label}${R}` : `${GRAY}${opt.label}${R}`
        const hint = opt.hint ? `  ${DIM}${opt.hint}${R}` : ''
        out += `      ${bullet}  ${text}${hint}\n`
      }
      out += `\n`
      return out
    }

    // Initial render
    const lines = options.length + 2
    write(render())

    // Raw mode for key input
    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    write(HIDE_CURSOR)

    return new Promise<string>((resolve) => {
      const onData = (buf: Buffer) => {
        const key = buf.toString()
        if (key === '\x1b[A' || key === 'k') { // Up
          selected = (selected - 1 + options.length) % options.length
        } else if (key === '\x1b[B' || key === 'j') { // Down
          selected = (selected + 1) % options.length
        } else if (key === '\r' || key === '\n') { // Enter
          process.stdin.removeListener('data', onData)
          if (process.stdin.isTTY) process.stdin.setRawMode(false)
          write(SHOW_CURSOR)
          // Clear and rewrite as confirmed
          write(UP(lines) + CLEAR_LINE)
          for (let i = 0; i < lines; i++) write(`${CLEAR_LINE}\n`)
          write(UP(lines))
          write(`   ${EMERALD}◇${R}  ${label}  ${EMERALD}${options[selected]!.label}${R}\n\n`)
          resolve(options[selected]!.value)
          return
        } else if (key === '\x03') { // Ctrl+C
          process.stdin.removeListener('data', onData)
          if (process.stdin.isTTY) process.stdin.setRawMode(false)
          write(SHOW_CURSOR + '\n')
          process.exit(0)
        }
        // Re-render
        write(UP(lines))
        write(render())
      }
      process.stdin.on('data', onData)
      process.stdin.resume()
    })
  }

  /** Yes/No confirm prompt */
  async confirm(label: string, defaultVal = false): Promise<boolean> {
    const options: SelectOption[] = [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ]
    const result = await this.select(label, options)
    return result === 'yes'
  }

  /** Progress spinner */
  spinner(label: string): { stop: (text: string) => void } {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let i = 0
    let running = true

    const interval = setInterval(() => {
      if (!running) return
      write(`\r  ${EMERALD}${frames[i % frames.length]}${R}  ${label}`)
      i++
    }, 80)

    return {
      stop(text: string) {
        running = false
        clearInterval(interval)
        write(`\r${CLEAR_LINE}  ${EMERALD}✓${R}  ${text}\n`)
      },
    }
  }

  /** Bordered summary box */
  box(lines: string[]): void {
    const stripped = lines.map(l => stripAnsi(l))
    const maxLen = Math.max(...stripped.map(l => l.length), 30)
    const w = maxLen + 4

    write('\n')
    write(`  ${GRAY}┌${'─'.repeat(w)}┐${R}\n`)
    for (const line of lines) {
      const pad = w - stripAnsi(line).length - 2
      write(`  ${GRAY}│${R} ${line}${' '.repeat(Math.max(0, pad))} ${GRAY}│${R}\n`)
    }
    write(`  ${GRAY}└${'─'.repeat(w)}┘${R}\n`)
    write('\n')
  }

  /** Simple info line */
  info(text: string): void {
    write(`  ${GRAY}│${R}  ${text}\n`)
  }

  /** Step label */
  step(text: string): void {
    write(`\n  ${EMERALD}▸${R}  ${BOLD}${text}${R}\n\n`)
  }
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}
