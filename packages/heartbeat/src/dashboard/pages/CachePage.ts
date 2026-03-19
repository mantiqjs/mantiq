import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml, truncate, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { CacheEntryContent } from '../../contracts/Entry.ts'

export async function renderCachePage(store: HeartbeatStore, basePath: string): Promise<string> {
  const entries = await store.getEntries({ type: 'cache', limit: 100 })

  let hits = 0, misses = 0, writes = 0, forgets = 0
  for (const e of entries) {
    const op = (JSON.parse(e.content) as CacheEntryContent).operation
    if (op === 'hit') hits++
    else if (op === 'miss') misses++
    else if (op === 'write') writes++
    else forgets++
  }

  const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(0) + '%' : '--'

  const rows = entries.map((entry) => {
    const c = JSON.parse(entry.content) as CacheEntryContent
    const v = c.operation === 'hit' ? 'green' : c.operation === 'miss' ? 'amber' : c.operation === 'write' ? 'blue' : 'mute'
    return [
      badge(c.operation, v as any),
      `<span class="mono trunc sm">${escapeHtml(truncate(c.key, 50))}</span>`,
      `<span class="sm muted">${escapeHtml(c.store)}</span>`,
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const content = `
    <h1 class="page-title">Cache</h1>
    <div class="stats">
      ${stat('Hit Rate', hitRate, `${hits} hits / ${misses} misses`)}
      ${stat('Hits', hits.toString())}
      ${stat('Writes', writes.toString())}
      ${stat('Forgets', forgets.toString())}
    </div>
    <div class="card">
      ${table(['Operation', 'Key', 'Store', 'Time'], rows)}
    </div>
  `

  return renderLayout({ title: 'Cache', activePage: 'cache', basePath, content })
}
