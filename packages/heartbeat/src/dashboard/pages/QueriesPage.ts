import { renderLayout } from '../shared/layout.ts'
import { table, badge, durationBadge, timeAgo, escapeHtml, truncate, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { QueryEntryContent } from '../../contracts/Entry.ts'

export async function renderQueriesPage(store: HeartbeatStore, basePath: string): Promise<string> {
  const entries = await store.getEntries({ type: 'query', limit: 100 })

  let slowCount = 0
  let nplusOneCount = 0
  for (const e of entries) {
    const c = JSON.parse(e.content) as QueryEntryContent
    if (c.slow) slowCount++
    if (c.n_plus_one) nplusOneCount++
  }

  const rows = entries.map((entry) => {
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

  const content = `
    <div class="stats">
      ${stat('Total', entries.length.toString())}
      ${stat('Slow', slowCount.toString(), '> threshold')}
      ${stat('N+1', nplusOneCount.toString(), 'Detected')}
    </div>
    <div class="card">
      ${table(['SQL', 'Connection', 'Duration', 'Flags', 'Time'], rows)}
    </div>
  `

  return renderLayout({ title: 'Queries', activePage: 'queries', basePath, content })
}
