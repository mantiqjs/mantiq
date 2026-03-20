import { renderLayout } from '../shared/layout.ts'
import { table, badge, durationBadge, timeAgo, escapeHtml, truncate, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { JobEntryContent } from '../../contracts/Entry.ts'

export async function renderJobsPage(store: HeartbeatStore, basePath: string): Promise<string> {
  const entries = await store.getEntries({ type: 'job', limit: 100 })

  let processed = 0, failed = 0, processing = 0
  for (const e of entries) {
    const s = (JSON.parse(e.content) as JobEntryContent).status
    if (s === 'processed') processed++
    else if (s === 'failed') failed++
    else processing++
  }

  const rows = entries.map((entry) => {
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

  const content = `
    <div class="stats">
      ${stat('Processed', processed.toString(), 'Completed')}
      ${stat('Failed', failed.toString())}
      ${stat('Processing', processing.toString(), 'Running')}
    </div>
    <div class="card">
      ${table(['Job', 'Queue', 'Status', 'Duration', 'Attempts', 'Error', 'Time'], rows)}
    </div>
  `

  return renderLayout({ title: 'Jobs', activePage: 'jobs', basePath, content })
}
