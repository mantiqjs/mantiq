import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml, truncate, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { ExceptionEntryContent } from '../../contracts/Entry.ts'

export async function renderExceptionsPage(store: HeartbeatStore, basePath: string): Promise<string> {
  const [groups, entries] = await Promise.all([
    store.getExceptionGroups(50),
    store.getEntries({ type: 'exception', limit: 50 }),
  ])

  const open = groups.filter((g) => !g.resolved_at).length

  const groupRows = groups.map((g) => [
    `<span class="mono">${escapeHtml(g.class)}</span>`,
    `<span class="trunc sm">${escapeHtml(truncate(g.message, 50))}</span>`,
    `<strong>${g.count}</strong>`,
    g.resolved_at ? badge('resolved', 'green') : badge('open', 'red'),
    `<span class="sm dim">${timeAgo(g.last_seen_at)}</span>`,
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
    <h1 class="page-title">Exceptions</h1>
    <div class="stats">
      ${stat('Total', entries.length.toString())}
      ${stat('Groups', groups.length.toString(), 'Unique')}
      ${stat('Open', open.toString(), 'Unresolved')}
    </div>
    <div class="card">
      <div class="card-title">Exception Groups</div>
      ${table(['Class', 'Message', 'Count', 'Status', 'Last Seen'], groupRows)}
    </div>
    <div class="card mt">
      <div class="card-title">Recent</div>
      ${table(['Class', 'Message', 'Location', 'Time'], recentRows)}
    </div>
  `

  return renderLayout({ title: 'Exceptions', activePage: 'exceptions', basePath, content })
}
