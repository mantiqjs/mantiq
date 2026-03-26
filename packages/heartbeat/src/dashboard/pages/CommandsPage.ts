import { renderLayout } from '../shared/layout.ts'
import { table, badge, durationBadge, timeAgo, escapeHtml, truncate, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { CommandEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

export async function renderCommandsPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = Math.max(1, parseInt(searchParams?.get('page') ?? '1', 10))

  const total = await store.countEntries('command')
  const entries = await store.getEntries({ type: 'command', limit: PER_PAGE, offset: (page - 1) * PER_PAGE })

  let successCount = 0, failureCount = 0
  for (const e of entries) {
    const c = JSON.parse(e.content) as CommandEntryContent
    if (c.exit_code === 0) successCount++
    else failureCount++
  }

  const rows = entries.map((entry) => {
    const c = JSON.parse(entry.content) as CommandEntryContent
    const href = `${basePath}/commands/${entry.uuid}`
    const argsPreview = truncate(JSON.stringify(c.arguments), 50)
    return [
      `<a href="${href}" class="mono sm" style="text-decoration:none;color:var(--fg-1)">${escapeHtml(c.name)}</a>`,
      `<span class="mono trunc sm muted" title="${escapeHtml(argsPreview)}">${escapeHtml(argsPreview)}</span>`,
      badge(String(c.exit_code), c.exit_code === 0 ? 'green' : 'red'),
      durationBadge(c.duration),
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const totalPages = Math.ceil(total / PER_PAGE)

  const content = `
    <div class="stats">
      ${stat('Total Commands', total.toString())}
      ${stat('Success', successCount.toString(), 'Exit code 0')}
      ${stat('Failures', failureCount.toString())}
    </div>

    <div class="card">
      ${table(['Command', 'Arguments', 'Exit Code', 'Duration', 'Time'], rows)}
    </div>

    ${pagination(basePath + '/commands', page, totalPages, searchParams)}
  `

  return renderLayout({ title: 'Commands', activePage: 'commands', basePath, content })
}

function pagination(baseUrl: string, current: number, total: number, searchParams?: URLSearchParams): string {
  if (total <= 1) return ''

  function buildUrl(p: number): string {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('page', String(p))
    return `${baseUrl}?${params.toString()}`
  }

  const items: string[] = []
  if (current > 1) {
    items.push(`<a href="${buildUrl(current - 1)}" style="padding:4px 10px;border-radius:4px;border:1px solid var(--border);color:var(--fg-2);text-decoration:none;font-size:12px">&larr; Prev</a>`)
  }
  items.push(`<span class="sm dim">Page ${current} of ${total}</span>`)
  if (current < total) {
    items.push(`<a href="${buildUrl(current + 1)}" style="padding:4px 10px;border-radius:4px;border:1px solid var(--border);color:var(--fg-2);text-decoration:none;font-size:12px">Next &rarr;</a>`)
  }

  return `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px">${items.join('')}</div>`
}
