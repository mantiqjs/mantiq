/**
 * Terminal output helpers with ANSI colors.
 * Zero dependencies — uses escape codes directly.
 */

const ESC = '\x1b['
const RESET = `${ESC}0m`
const BOLD = `${ESC}1m`
const DIM = `${ESC}2m`

const FG = {
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`,
  emerald: `${ESC}38;2;52;211;153m`,
} as const

export class IO {
  info(msg: string): void {
    console.log(`${FG.gray}  INFO${RESET}  ${msg}`)
  }

  success(msg: string): void {
    console.log(`${FG.emerald}  DONE${RESET}  ${msg}`)
  }

  error(msg: string): void {
    console.error(`${FG.red}  ERROR${RESET} ${msg}`)
  }

  warn(msg: string): void {
    console.log(`${FG.yellow}  WARN${RESET}  ${msg}`)
  }

  line(msg = ''): void {
    console.log(msg)
  }

  newLine(): void {
    console.log()
  }

  /** Bold heading */
  heading(msg: string): void {
    console.log(`\n${BOLD}${msg}${RESET}`)
  }

  /** Dim/muted text */
  muted(msg: string): void {
    console.log(`${DIM}${msg}${RESET}`)
  }

  /** Colorize inline text */
  green(msg: string): string { return `${FG.green}${msg}${RESET}` }
  red(msg: string): string { return `${FG.red}${msg}${RESET}` }
  yellow(msg: string): string { return `${FG.yellow}${msg}${RESET}` }
  cyan(msg: string): string { return `${FG.cyan}${msg}${RESET}` }
  gray(msg: string): string { return `${FG.gray}${msg}${RESET}` }
  emerald(msg: string): string { return `${FG.emerald}${msg}${RESET}` }
  bold(msg: string): string { return `${BOLD}${msg}${RESET}` }

  /** Print brand mark */
  brand(): void {
    console.log(`\n  ${FG.emerald}mantiq${RESET} ${DIM}framework${RESET}\n`)
  }

  /** Print a table with aligned columns */
  table(headers: string[], rows: string[][]): void {
    // Strip ANSI codes for width calculation
    const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

    const widths = headers.map((h, i) =>
      Math.max(strip(h).length, ...rows.map((r) => strip(r[i] ?? '').length)),
    )

    const sep = widths.map((w) => '-'.repeat(w + 2)).join('+')
    const formatRow = (row: string[]) =>
      row.map((cell, i) => {
        const pad = widths[i]! - strip(cell).length
        return ` ${cell}${' '.repeat(Math.max(0, pad))} `
      }).join('|')

    this.line(`  ${FG.gray}${sep}${RESET}`)
    this.line(`  ${BOLD}${formatRow(headers)}${RESET}`)
    this.line(`  ${FG.gray}${sep}${RESET}`)
    for (const row of rows) {
      this.line(`  ${formatRow(row)}`)
    }
    this.line(`  ${FG.gray}${sep}${RESET}`)
  }

  /** Simple two-column display like Laravel */
  twoColumn(label: string, value: string, width = 30): void {
    this.line(`  ${label.padEnd(width)} ${FG.gray}${value}${RESET}`)
  }
}

export const io = new IO()
