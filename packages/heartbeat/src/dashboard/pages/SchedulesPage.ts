import { renderLayout } from '../shared/layout.ts'
import { table, badge, durationBadge, timeAgo, escapeHtml, truncate, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { ScheduleEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

export async function renderSchedulesPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = Math.max(1, parseInt(searchParams?.get('page') ?? '1', 10))

  const total = await store.countEntries('schedule')
  const entries = await store.getEntries({ type: 'schedule', limit: PER_PAGE, offset: (page - 1) * PER_PAGE })

  let successCount = 0, errorCount = 0
  for (const e of entries) {
    const s = (JSON.parse(e.content) as ScheduleEntryContent).status
    if (s === 'success') successCount++
    else errorCount++
  }

  const rows = entries.map((entry) => {
    const c = JSON.parse(entry.content) as ScheduleEntryContent
    return [
      `<span class="mono sm">${escapeHtml(c.command)}</span>`,
      `<span class="mono sm muted">${escapeHtml(c.expression)}</span>`,
      durationBadge(c.duration),
      badge(c.status, c.status === 'success' ? 'green' : 'red'),
      c.output ? `<span class="sm trunc muted" title="${escapeHtml(c.output)}">${escapeHtml(truncate(c.output, 60))}</span>` : '<span class="dim">--</span>',
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const totalPages = Math.ceil(total / PER_PAGE)

  const content = `
    <div class="stats">
      ${stat('Total Runs', total.toString())}
      ${stat('Success', successCount.toString())}
      ${stat('Errors', errorCount.toString())}
    </div>

    <div class="card">
      ${table(['Command', 'Expression', 'Duration', 'Status', 'Output', 'Time'], rows)}
    </div>

    ${pagination(basePath + '/schedules', page, totalPages, searchParams)}
  `

  return renderLayout({ title: 'Schedules', activePage: 'schedules', basePath, content })
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
