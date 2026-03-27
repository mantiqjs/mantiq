import { renderLayout } from '../shared/layout.ts'
import { table, statusBadge, methodBadge, durationBadge, timeAgo, escapeHtml, truncate, filterBar, pagination } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { RequestEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

export async function renderRequestsPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = parseInt(searchParams?.get('page') ?? '1')
  const method = searchParams?.get('method') ?? ''
  const status = searchParams?.get('status') ?? ''
  const search = searchParams?.get('search') ?? ''

  // Build status range for search
  let statusMin: number | undefined
  let statusMax: number | undefined
  if (status === '2xx') { statusMin = 200; statusMax = 299 }
  else if (status === '3xx') { statusMin = 300; statusMax = 399 }
  else if (status === '4xx') { statusMin = 400; statusMax = 499 }
  else if (status === '5xx') { statusMin = 500; statusMax = 599 }

  // Fetch all matching entries (use searchEntries for filtered queries)
  const hasFilters = method || status || search
  let entries: any[]
  let total: number

  if (hasFilters) {
    // When using searchEntries, we need to post-filter since it uses LIKE on content JSON
    const allEntries = await store.getEntries({ type: 'request', limit: 5000 })

    // Apply in-memory filters for precise matching
    const filtered = allEntries.filter((entry) => {
      const c = JSON.parse(entry.content) as RequestEntryContent
      if (method && c.method !== method) return false
      if (statusMin !== undefined && (c.status < statusMin || c.status > statusMax!)) return false
      if (search && !c.path.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    total = filtered.length
    entries = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  } else {
    total = await store.countEntries('request')
    entries = await store.getEntries({ type: 'request', limit: PER_PAGE, offset: (page - 1) * PER_PAGE })
  }

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

  // Build extra params for pagination links
  const extraParams: Record<string, string> = {}
  if (method) extraParams['method'] = method
  if (status) extraParams['status'] = status
  if (search) extraParams['search'] = search

  const filters = filterBar({
    action: `${basePath}/requests`,
    searchPlaceholder: 'Search path...',
    searchValue: search,
    filters: [
      {
        name: 'method',
        label: 'Method',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' },
        ],
        selected: method,
      },
      {
        name: 'status',
        label: 'Status',
        options: [
          { value: '2xx', label: '2xx Success' },
          { value: '3xx', label: '3xx Redirect' },
          { value: '4xx', label: '4xx Client Error' },
          { value: '5xx', label: '5xx Server Error' },
        ],
        selected: status,
      },
    ],
  })

  // Build pagination URL base
  const paginationBase = buildPaginationUrl(`${basePath}/requests`, extraParams)

  const content = `
    ${filters}
    <div class="card">
      ${table(['Method', 'Path', 'Status', 'Duration', 'IP', 'Time'], rows)}
    </div>
    ${pagination(total, page, PER_PAGE, paginationBase)}
  `

  return renderLayout({ title: 'Requests', activePage: 'requests', basePath, content })
}

function buildPaginationUrl(base: string, params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v)
  if (entries.length === 0) return base
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  return `${base}?${qs}`
}
