import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml, truncate, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { LogEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

const LEVEL_VARIANTS: Record<string, 'red' | 'amber' | 'blue' | 'mute'> = {
  emergency: 'red',
  alert: 'red',
  critical: 'red',
  error: 'red',
  warning: 'amber',
  notice: 'blue',
  info: 'blue',
  debug: 'mute',
}

const LEVELS = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency']

function originBadge(entry: { origin_type: string }): string {
  const v: Record<string, 'green' | 'blue' | 'amber' | 'mute'> = {
    request: 'green',
    command: 'blue',
    schedule: 'amber',
    job: 'blue',
  }
  return badge(entry.origin_type, v[entry.origin_type] ?? 'mute')
}

export async function renderLogsPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = Math.max(1, parseInt(searchParams?.get('page') ?? '1', 10))
  const levelFilter = searchParams?.get('level') ?? ''
  const search = searchParams?.get('q') ?? ''

  const total = await store.countEntries('log')
  const entries = await store.getEntries({ type: 'log', limit: PER_PAGE, offset: (page - 1) * PER_PAGE })

  // Count by level from fetched + total entries
  let errorCount = 0, warningCount = 0
  const filtered: typeof entries = []
  for (const e of entries) {
    const c = JSON.parse(e.content) as LogEntryContent
    if (c.level === 'error' || c.level === 'critical' || c.level === 'alert' || c.level === 'emergency') errorCount++
    if (c.level === 'warning') warningCount++

    if (levelFilter && c.level !== levelFilter) continue
    if (search && !c.message.toLowerCase().includes(search.toLowerCase())) continue
    filtered.push(e)
  }

  const rows = filtered.map((entry) => {
    const c = JSON.parse(entry.content) as LogEntryContent
    return [
      badge(c.level, LEVEL_VARIANTS[c.level] ?? 'mute'),
      `<span class="mono trunc sm" title="${escapeHtml(c.message)}">${escapeHtml(truncate(c.message, 80))}</span>`,
      `<span class="sm muted">${escapeHtml(c.channel)}</span>`,
      originBadge(entry),
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const totalPages = Math.ceil(total / PER_PAGE)

  const levelOptions = LEVELS
    .map((l) => `<option value="${l}"${levelFilter === l ? ' selected' : ''}>${l}</option>`)
    .join('')

  const content = `
    <div class="stats">
      ${stat('Total Logs', total.toString())}
      ${stat('Errors', errorCount.toString())}
      ${stat('Warnings', warningCount.toString())}
    </div>

    <div class="card mb" style="padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <form method="get" action="${basePath}/logs" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:1">
        <select name="level" style="padding:5px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:12px">
          <option value="">All levels</option>
          ${levelOptions}
        </select>
        <input type="text" name="q" value="${escapeHtml(search)}" placeholder="Search message\u2026" style="padding:5px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:12px;flex:1;min-width:160px">
        <button type="submit" style="padding:5px 12px;border-radius:4px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:12px;cursor:pointer">Filter</button>
      </form>
    </div>

    <div class="card">
      ${table(['Level', 'Message', 'Channel', 'Origin', 'Time'], rows)}
    </div>

    ${pagination(basePath + '/logs', page, totalPages, searchParams)}
  `

  return renderLayout({ title: 'Logs', activePage: 'logs', basePath, content })
}

function pagination(baseUrl: string, current: number, total: number, searchParams?: URLSearchParams): string {
  if (total <= 1) return ''

  function buildUrl(p: number): string {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('page', String(p))
    return `${baseUrl}?${params.toString()}`
  }

  const items: string[] = []
  if (current > 1) {
    items.push(`<a href="${buildUrl(current - 1)}" style="padding:4px 10px;border-radius:4px;border:1px solid var(--border);color:var(--fg-2);text-decoration:none;font-size:12px">&larr; Prev</a>`)
  }
  items.push(`<span class="sm dim">Page ${current} of ${total}</span>`)
  if (current < total) {
    items.push(`<a href="${buildUrl(current + 1)}" style="padding:4px 10px;border-radius:4px;border:1px solid var(--border);color:var(--fg-2);text-decoration:none;font-size:12px">Next &rarr;</a>`)
  }

  return `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px">${items.join('')}</div>`
}
