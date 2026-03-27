import { renderLayout } from '../shared/layout.ts'
import { table, badge, durationBadge, timeAgo, escapeHtml, truncate, stat, filterBar, pagination } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { JobEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

export async function renderJobsPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = parseInt(searchParams?.get('page') ?? '1')
  const statusFilter = searchParams?.get('status') ?? ''
  const queueSearch = searchParams?.get('queue') ?? ''

  // Fetch all job entries for stats + filtering
  const allEntries = await store.getEntries({ type: 'job', limit: 5000 })

  // Apply filters in-memory
  const filtered = allEntries.filter((e) => {
    const c = JSON.parse(e.content) as JobEntryContent
    if (statusFilter && c.status !== statusFilter) return false
    if (queueSearch && !c.queue.toLowerCase().includes(queueSearch.toLowerCase())) return false
    return true
  })

  const total = filtered.length

  // Compute stats from filtered entries
  let processed = 0, failed = 0, processing = 0
  for (const e of filtered) {
    const s = (JSON.parse(e.content) as JobEntryContent).status
    if (s === 'processed') processed++
    else if (s === 'failed') failed++
    else processing++
  }

  // Paginate
  const pageEntries = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const rows = pageEntries.map((entry) => {
    const c = JSON.parse(entry.content) as JobEntryContent
    const v = c.status === 'processed' ? 'green' : c.status === 'failed' ? 'red' : 'blue'
    return [
      `<span class="mono sm">${escapeHtml(c.job_name)}</span>`,
      `<span class="sm muted">${escapeHtml(c.queue)}</span>`,
      badge(c.status, v as any),
      c.duration !== null ? durationBadge(c.duration) : '<span class="dim">--</span>',
      `<span class="sm">${c.attempts}</span>`,
      c.error ? `<span class="sm trunc muted">${escapeHtml(truncate(c.error, 40))}</span>` : '<span class="dim">--</span>',
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  // Build extra params for pagination
  const extraParams: Record<string, string> = {}
  if (statusFilter) extraParams['status'] = statusFilter
  if (queueSearch) extraParams['queue'] = queueSearch

  const filters = filterBar({
    action: `${basePath}/jobs`,
    searchPlaceholder: 'Search queue...',
    searchValue: queueSearch,
    filters: [
      {
        name: 'status',
        label: 'Status',
        options: [
          { value: 'processing', label: 'Processing' },
          { value: 'processed', label: 'Processed' },
          { value: 'failed', label: 'Failed' },
        ],
        selected: statusFilter,
      },
    ],
  })

  // Rename search param to queue for the filter bar
  const paginationBase = buildPaginationUrl(`${basePath}/jobs`, extraParams)

  const content = `
    ${filters}
    <div class="stats">
      ${stat('Processed', processed.toString(), 'Completed')}
      ${stat('Failed', failed.toString())}
      ${stat('Processing', processing.toString(), 'Running')}
    </div>
    <div class="card">
      ${table(['Job', 'Queue', 'Status', 'Duration', 'Attempts', 'Error', 'Time'], rows)}
    </div>
    ${pagination(total, page, PER_PAGE, paginationBase)}
  `

  return renderLayout({ title: 'Jobs', activePage: 'jobs', basePath, content })
}

function buildPaginationUrl(base: string, params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v)
  if (entries.length === 0) return base
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  return `${base}?${qs}`
}
