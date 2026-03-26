import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml, truncate, stat, pagination } from '../shared/components.ts'
import { sparkline } from '../shared/charts.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { ExceptionEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

export async function renderExceptionsPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = parseInt(searchParams?.get('page') ?? '1')

  const [groups, totalExceptions] = await Promise.all([
    store.getExceptionGroups(50),
    store.countEntries('exception'),
  ])

  // Fetch paginated recent exceptions
  const entries = await store.getEntries({ type: 'exception', limit: PER_PAGE, offset: (page - 1) * PER_PAGE })

  const open = groups.filter((g) => !g.resolved_at).length

  // Sparkline: exception count per hour over the last 24h
  const now = Date.now()
  const hourBuckets = new Array(24).fill(0)
  const last24h = now - 86_400_000

  // Fetch entries for sparkline (last 24h of exceptions)
  const sparklineEntries = await store.getEntries({ type: 'exception', limit: 5000 })
  for (const entry of sparklineEntries) {
    if (entry.created_at < last24h) continue
    const hourIdx = Math.min(Math.floor((entry.created_at - last24h) / 3_600_000), 23)
    hourBuckets[hourIdx]++
  }

  const trendChart = sparkline(hourBuckets, { width: 200, height: 36, color: '#f87171' })

  const groupRows = groups.map((g) => [
    `<span class="mono">${escapeHtml(g.class)}</span>`,
    `<span class="trunc sm">${escapeHtml(truncate(g.message, 50))}</span>`,
    `<strong>${g.count}</strong>`,
    g.resolved_at ? badge('resolved', 'green') : badge('open', 'red'),
    `<span class="sm dim">${timeAgo(g.last_seen_at)}</span>`,
    g.resolved_at
      ? `<a href="${basePath}/api/exceptions/${encodeURIComponent(g.fingerprint)}/unresolve" style="font-size:11px;color:#fbbf24;text-decoration:none;border:1px solid #fbbf24;border-radius:4px;padding:2px 8px" onclick="return confirm('Unresolve this exception group?')">Unresolve</a>`
      : `<a href="${basePath}/api/exceptions/${encodeURIComponent(g.fingerprint)}/resolve" style="font-size:11px;color:#34d399;text-decoration:none;border:1px solid #34d399;border-radius:4px;padding:2px 8px" onclick="return confirm('Resolve this exception group?')">Resolve</a>`,
  ])

  const recentRows = entries.map((entry) => {
    const c = JSON.parse(entry.content) as ExceptionEntryContent
    return [
      `<span class="mono sm">${escapeHtml(c.class)}</span>`,
      `<span class="trunc sm">${escapeHtml(truncate(c.message, 50))}</span>`,
      c.file ? `<span class="mono sm dim">${escapeHtml(truncate(c.file, 30))}:${c.line ?? ''}</span>` : '<span class="dim">--</span>',
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const content = `
    <div class="stats">
      ${stat('Total', totalExceptions.toString())}
      ${stat('Groups', groups.length.toString(), 'Unique')}
      ${stat('Open', open.toString(), 'Unresolved')}
      <div class="stat">
        <div class="stat-label">Trend (24h)</div>
        <div style="padding:4px 0">${trendChart}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Exception Groups</div>
      ${table(['Class', 'Message', 'Count', 'Status', 'Last Seen', 'Action'], groupRows)}
    </div>
    <div class="card mt">
      <div class="card-title">Recent</div>
      ${table(['Class', 'Message', 'Location', 'Time'], recentRows)}
    </div>
    ${pagination(totalExceptions, page, PER_PAGE, `${basePath}/exceptions`)}
  `

  return renderLayout({ title: 'Exceptions', activePage: 'exceptions', basePath, content })
}
