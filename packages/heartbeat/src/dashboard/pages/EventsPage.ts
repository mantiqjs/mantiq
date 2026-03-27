import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml, truncate, stat, pagination } from '../shared/components.ts'
import { barChart } from '../shared/charts.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { EventEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

export async function renderEventsPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = parseInt(searchParams?.get('page') ?? '1')

  // Fetch all event entries for stats + frequency chart
  const allEntries = await store.getEntries({ type: 'event', limit: 5000 })
  const total = allEntries.length

  // Compute event frequency for bar chart
  const frequencyMap = new Map<string, number>()
  for (const entry of allEntries) {
    const c = JSON.parse(entry.content) as EventEntryContent
    const cls = c.event_class
    frequencyMap.set(cls, (frequencyMap.get(cls) ?? 0) + 1)
  }

  const topEvents = Array.from(frequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label: truncate(label, 25), value, color: 'var(--accent)' }))

  // Paginate
  const pageEntries = allEntries.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const rows = pageEntries.map((entry) => {
    const c = JSON.parse(entry.content) as EventEntryContent

    // Payload preview
    let payloadHtml = '<span class="dim">--</span>'
    if (c.payload && Object.keys(c.payload).length > 0) {
      const preview = truncate(JSON.stringify(c.payload), 100)
      payloadHtml = `<code class="mono sm" style="background:var(--bg-2);padding:2px 6px;border-radius:3px;font-size:10px">${escapeHtml(preview)}</code>`
    }

    // Listener names
    let listenersHtml = `<span class="sm muted">${c.listeners_count} listener${c.listeners_count !== 1 ? 's' : ''}</span>`
    if (c.listeners && c.listeners.length > 0) {
      const listenerNames = c.listeners.map((l) => escapeHtml(l)).join(', ')
      listenersHtml = `<span class="sm muted" title="${listenerNames}">${escapeHtml(truncate(c.listeners.join(', '), 60))}</span>`
    }

    return [
      `<span class="mono sm">${escapeHtml(c.event_class)}</span>`,
      listenersHtml,
      payloadHtml,
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const frequencyChart = topEvents.length > 0 ? barChart(topEvents) : ''

  const content = `
    <div class="stats">
      ${stat('Total Events', total.toString())}
      ${stat('Unique Events', frequencyMap.size.toString(), 'Distinct classes')}
    </div>

    ${frequencyChart ? `
    <div class="card mb">
      <div class="card-title">Top 10 Events by Frequency</div>
      <div style="padding:8px 0">${frequencyChart}</div>
    </div>` : ''}

    <div class="card">
      ${table(['Event', 'Listeners', 'Payload', 'Time'], rows)}
    </div>
    ${pagination(total, page, PER_PAGE, `${basePath}/events`)}
  `

  return renderLayout({ title: 'Events', activePage: 'events', basePath, content })
}
