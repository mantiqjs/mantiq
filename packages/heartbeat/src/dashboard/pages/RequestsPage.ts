import { renderLayout } from '../shared/layout.ts'
import { table, statusBadge, methodBadge, durationBadge, timeAgo, escapeHtml, truncate } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { RequestEntryContent } from '../../contracts/Entry.ts'

export async function renderRequestsPage(store: HeartbeatStore, basePath: string): Promise<string> {
  const entries = await store.getEntries({ type: 'request', limit: 100 })

  const rows = entries.map((entry) => {
    const c = JSON.parse(entry.content) as RequestEntryContent
    const href = `${basePath}/requests/${entry.uuid}`
    return [
      methodBadge(c.method),
      `<a href="${href}" class="mono trunc" style="text-decoration:none;color:var(--fg-1)" title="${escapeHtml(c.path)}">${escapeHtml(truncate(c.path, 50))}</a>`,
      statusBadge(c.status),
      durationBadge(c.duration),
      c.ip ? `<span class="sm muted mono">${c.ip}</span>` : '<span class="dim">--</span>',
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const content = `
    <div class="card">
      ${table(['Method', 'Path', 'Status', 'Duration', 'IP', 'Time'], rows)}
    </div>
  `

  return renderLayout({ title: 'Requests', activePage: 'requests', basePath, content })
}
