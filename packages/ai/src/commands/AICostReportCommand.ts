import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { Application } from '@mantiq/core'
import { UsageTracker } from '../observability/UsageTracker.ts'

/**
 * Show AI usage/cost report from UsageTracker.
 *
 * Usage: bun mantiq ai:cost:report [--since=24h|7d|30d]
 */
export class AICostReportCommand extends Command {
  override name = 'ai:cost:report'
  override description = 'Show AI usage and cost report'
  override usage = 'ai:cost:report [--since=24h|7d|30d]'

  override async handle(args: ParsedArgs): Promise<number> {
    const sinceFlag = args.flags['since'] as string | undefined
    const since = sinceFlag ? this.parseSince(sinceFlag) : undefined

    const tracker = Application.getInstance().make(UsageTracker)
    const reportOpts: { since?: Date } = {}
    if (since) reportOpts.since = since
    const report = tracker.report(reportOpts)

    if (report.requestCount === 0) {
      this.io.info('No usage data recorded.')
      return 0
    }

    this.io.heading('AI Usage Report')
    if (since) {
      this.io.muted(`  Since: ${since.toISOString()}`)
    }
    this.io.newLine()

    this.io.twoColumn('Total requests:', String(report.requestCount))
    this.io.twoColumn('Total tokens:', report.totalTokens.toLocaleString())
    this.io.twoColumn('Total cost:', `$${report.totalCost.toFixed(4)}`)
    this.io.twoColumn('Avg latency:', `${report.avgLatencyMs.toFixed(0)}ms`)
    this.io.newLine()

    // By model
    const modelRows = Object.entries(report.byModel).map(([model, data]) => [
      model,
      data.tokens.toLocaleString(),
      `$${data.cost.toFixed(4)}`,
      String(data.count),
    ])

    if (modelRows.length > 0) {
      this.io.heading('By Model')
      this.io.table(['Model', 'Tokens', 'Cost', 'Requests'], modelRows)
      this.io.newLine()
    }

    // By provider
    const providerRows = Object.entries(report.byProvider).map(([provider, data]) => [
      provider,
      data.tokens.toLocaleString(),
      `$${data.cost.toFixed(4)}`,
      String(data.count),
    ])

    if (providerRows.length > 0) {
      this.io.heading('By Provider')
      this.io.table(['Provider', 'Tokens', 'Cost', 'Requests'], providerRows)
      this.io.newLine()
    }

    return 0
  }

  private parseSince(value: string): Date {
    const now = Date.now()
    const match = value.match(/^(\d+)(h|d)$/)
    if (!match) {
      this.io.warn(`Invalid --since value "${value}", defaulting to 24h`)
      return new Date(now - 24 * 60 * 60 * 1000)
    }

    const amount = Number(match[1])
    const unit = match[2]
    const ms = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000
    return new Date(now - ms)
  }
}
