import { renderLayout } from '../shared/layout.ts'
import { table, badge, durationBadge, timeAgo, escapeHtml, truncate, stat, filterBar, pagination, sqlHighlight } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { QueryEntryContent } from '../../contracts/Entry.ts'
import { formatDuration } from '../../helpers/timing.ts'

const PER_PAGE = 50

export async function renderQueriesPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = parseInt(searchParams?.get('page') ?? '1')
  const search = searchParams?.get('search') ?? ''

  // Fetch all query entries for stats computation, then paginate
  const allEntries = await store.getEntries({ type: 'query', limit: 5000 })

  // Apply search filter in-memory
  const filtered = search
    ? allEntries.filter((e) => {
        const c = JSON.parse(e.content) as QueryEntryContent
        return c.sql.toLowerCase().includes(search.toLowerCase()) || c.normalized_sql.toLowerCase().includes(search.toLowerCase())
      })
    : allEntries

  const total = filtered.length

  let slowCount = 0
  let nplusOneCount = 0
  let totalDuration = 0
  const slowEntries: typeof filtered = []
  const nplusOneEntries: typeof filtered = []

  for (const e of filtered) {
    const c = JSON.parse(e.content) as QueryEntryContent
    totalDuration += c.duration
    if (c.slow) {
      slowCount++
      slowEntries.push(e)
    }
    if (c.n_plus_one) {
      nplusOneCount++
      nplusOneEntries.push(e)
    }
  }

  const avgDuration = filtered.length > 0 ? totalDuration / filtered.length : 0

  // Paginate
  const pageEntries = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const rows = pageEntries.map((entry) => {
    const c = JSON.parse(entry.content) as QueryEntryContent
    const flags = []
    if (c.slow) flags.push(badge('slow', 'red'))
    if (c.n_plus_one) flags.push(badge('N+1', 'amber'))

    return [
      `<span class="mono trunc" title="${escapeHtml(c.sql)}">${escapeHtml(truncate(c.sql, 60))}</span>`,
      `<span class="sm muted">${escapeHtml(c.connection)}</span>`,
      durationBadge(c.duration, 100),
      flags.join(' ') || '<span class="dim">--</span>',
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  // Slow queries table
  const slowRows = slowEntries.slice(0, 20).map((entry) => {
    const c = JSON.parse(entry.content) as QueryEntryContent
    return [
      `<div>${sqlHighlight(truncate(c.sql, 80))}</div>`,
      `<span class="sm muted">${escapeHtml(c.connection)}</span>`,
      durationBadge(c.duration, 100),
      c.caller ? `<span class="mono sm dim">${escapeHtml(truncate(c.caller, 40))}</span>` : '<span class="dim">--</span>',
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  // N+1 detected table
  const nplusOneRows = nplusOneEntries.slice(0, 20).map((entry) => {
    const c = JSON.parse(entry.content) as QueryEntryContent
    return [
      `<div>${sqlHighlight(truncate(c.sql, 80))}</div>`,
      `<span class="sm muted">${escapeHtml(c.connection)}</span>`,
      durationBadge(c.duration, 100),
      c.caller ? `<span class="mono sm dim">${escapeHtml(truncate(c.caller, 40))}</span>` : '<span class="dim">--</span>',
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  // Build filter bar
  const extraParams: Record<string, string> = {}
  if (search) extraParams['search'] = search

  const filters = filterBar({
    action: `${basePath}/queries`,
    searchPlaceholder: 'Search SQL...',
    searchValue: search,
  })

  const paginationBase = search ? `${basePath}/queries?search=${encodeURIComponent(search)}` : `${basePath}/queries`

  const content = `
    ${filters}
    <div class="stats">
      ${stat('Total', total.toString())}
      ${stat('Avg Duration', formatDuration(avgDuration), 'Per query')}
      ${stat('Slow', slowCount.toString(), '> threshold')}
      ${stat('N+1', nplusOneCount.toString(), 'Detected')}
    </div>
    <div class="card">
      ${table(['SQL', 'Connection', 'Duration', 'Flags', 'Time'], rows)}
    </div>
    ${pagination(total, page, PER_PAGE, paginationBase)}

    ${slowEntries.length > 0 ? `
    <div class="card mt">
      <div class="card-title">Slow Queries <span class="sm dim">(${slowCount})</span></div>
      ${table(['SQL', 'Connection', 'Duration', 'Caller', 'Time'], slowRows)}
    </div>` : ''}

    ${nplusOneEntries.length > 0 ? `
    <div class="card mt">
      <div class="card-title">N+1 Detected <span class="sm dim">(${nplusOneCount})</span></div>
      ${table(['SQL', 'Connection', 'Duration', 'Caller', 'Time'], nplusOneRows)}
    </div>` : ''}
  `

  return renderLayout({ title: 'Queries', activePage: 'queries', basePath, content })
}
