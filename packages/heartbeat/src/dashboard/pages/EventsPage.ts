import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { EventEntryContent } from '../../contracts/Entry.ts'

export async function renderEventsPage(store: HeartbeatStore, basePath: string): Promise<string> {
  const entries = await store.getEntries({ type: 'event', limit: 100 })

  const rows = entries.map((entry) => {
    const c = JSON.parse(entry.content) as EventEntryContent
    return [
      `<span class="mono sm">${escapeHtml(c.event_class)}</span>`,
      `<span class="sm muted">${c.listeners_count} listener${c.listeners_count !== 1 ? 's' : ''}</span>`,
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const content = `
    <div class="card">
      ${table(['Event', 'Listeners', 'Time'], rows)}
    </div>
  `

  return renderLayout({ title: 'Events', activePage: 'events', basePath, content })
}
