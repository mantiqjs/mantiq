import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml, truncate, stat, filterBar, pagination } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { CacheEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

export async function renderCachePage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = parseInt(searchParams?.get('page') ?? '1')
  const operationFilter = searchParams?.get('operation') ?? ''
  const keySearch = searchParams?.get('search') ?? ''

  // Fetch all cache entries for stats + filtering
  const allEntries = await store.getEntries({ type: 'cache', limit: 5000 })

  // Apply filters in-memory
  const filtered = allEntries.filter((e) => {
    const c = JSON.parse(e.content) as CacheEntryContent
    if (operationFilter && c.operation !== operationFilter) return false
    if (keySearch && !c.key.toLowerCase().includes(keySearch.toLowerCase())) return false
    return true
  })

  const total = filtered.length

  // Compute stats from all entries (not just filtered) for overall hit rate
  let hits = 0, misses = 0, writes = 0, forgets = 0
  for (const e of allEntries) {
    const op = (JSON.parse(e.content) as CacheEntryContent).operation
    if (op === 'hit') hits++
    else if (op === 'miss') misses++
    else if (op === 'write') writes++
    else forgets++
  }

  const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(0) + '%' : '--'

  // Paginate filtered entries
  const pageEntries = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const rows = pageEntries.map((entry) => {
    const c = JSON.parse(entry.content) as CacheEntryContent
    const v = c.operation === 'hit' ? 'green' : c.operation === 'miss' ? 'amber' : c.operation === 'write' ? 'blue' : 'mute'
    return [
      badge(c.operation, v as any),
      `<span class="mono trunc sm">${escapeHtml(truncate(c.key, 50))}</span>`,
      `<span class="sm muted">${escapeHtml(c.store)}</span>`,
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  // Build extra params for pagination
  const extraParams: Record<string, string> = {}
  if (operationFilter) extraParams['operation'] = operationFilter
  if (keySearch) extraParams['search'] = keySearch

  const filters = filterBar({
    action: `${basePath}/cache`,
    searchPlaceholder: 'Search key...',
    searchValue: keySearch,
    filters: [
      {
        name: 'operation',
        label: 'Operation',
        options: [
          { value: 'hit', label: 'Hit' },
          { value: 'miss', label: 'Miss' },
          { value: 'write', label: 'Write' },
          { value: 'forget', label: 'Forget' },
        ],
        selected: operationFilter,
      },
    ],
  })

  const paginationBase = buildPaginationUrl(`${basePath}/cache`, extraParams)

  const content = `
    ${filters}
    <div class="stats">
      ${stat('Hit Rate', hitRate, `${hits} hits / ${misses} misses`)}
      ${stat('Hits', hits.toString())}
      ${stat('Writes', writes.toString())}
      ${stat('Forgets', forgets.toString())}
    </div>
    <div class="card">
      ${table(['Operation', 'Key', 'Store', 'Time'], rows)}
    </div>
    ${pagination(total, page, PER_PAGE, paginationBase)}
  `

  return renderLayout({ title: 'Cache', activePage: 'cache', basePath, content })
}

function buildPaginationUrl(base: string, params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v)
  if (entries.length === 0) return base
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  return `${base}?${qs}`
}
