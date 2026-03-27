import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml, truncate, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { ModelEntryContent } from '../../contracts/Entry.ts'

const PER_PAGE = 50

const ACTION_VARIANTS: Record<string, 'green' | 'blue' | 'red'> = {
  created: 'green',
  updated: 'blue',
  deleted: 'red',
}

function originBadge(entry: { origin_type: string }): string {
  const v: Record<string, 'green' | 'blue' | 'amber' | 'mute'> = {
    request: 'green',
    command: 'blue',
    schedule: 'amber',
    job: 'blue',
  }
  return badge(entry.origin_type, v[entry.origin_type] ?? 'mute')
}

export async function renderModelsPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = Math.max(1, parseInt(searchParams?.get('page') ?? '1', 10))
  const actionFilter = searchParams?.get('action') ?? ''
  const search = searchParams?.get('q') ?? ''

  const total = await store.countEntries('model')
  const entries = await store.getEntries({ type: 'model', limit: PER_PAGE, offset: (page - 1) * PER_PAGE })

  let creates = 0, updates = 0, deletes = 0
  const filtered: typeof entries = []
  for (const e of entries) {
    const c = JSON.parse(e.content) as ModelEntryContent
    if (c.action === 'created') creates++
    else if (c.action === 'updated') updates++
    else if (c.action === 'deleted') deletes++

    if (actionFilter && c.action !== actionFilter) continue
    if (search && !c.model_class.toLowerCase().includes(search.toLowerCase())) continue
    filtered.push(e)
  }

  const rows = filtered.map((entry) => {
    const c = JSON.parse(entry.content) as ModelEntryContent
    const changesPreview = c.changes ? truncate(JSON.stringify(c.changes), 60) : '--'
    return [
      badge(c.action, ACTION_VARIANTS[c.action] ?? 'mute'),
      `<span class="mono sm">${escapeHtml(c.model_class)}</span>`,
      c.key != null ? `<span class="mono sm muted">${escapeHtml(String(c.key))}</span>` : '<span class="dim">--</span>',
      `<span class="mono trunc sm" title="${escapeHtml(changesPreview)}">${escapeHtml(changesPreview)}</span>`,
      originBadge(entry),
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  })

  const totalPages = Math.ceil(total / PER_PAGE)

  const actionOptions = ['created', 'updated', 'deleted']
    .map((a) => `<option value="${a}"${actionFilter === a ? ' selected' : ''}>${a}</option>`)
    .join('')

  const content = `
    <div class="stats">
      ${stat('Total Events', total.toString())}
      ${stat('Creates', creates.toString())}
      ${stat('Updates', updates.toString())}
      ${stat('Deletes', deletes.toString())}
    </div>

    <div class="card mb" style="padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <form method="get" action="${basePath}/models" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:1">
        <select name="action" style="padding:5px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:12px">
          <option value="">All actions</option>
          ${actionOptions}
        </select>
        <input type="text" name="q" value="${escapeHtml(search)}" placeholder="Search model class\u2026" style="padding:5px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:12px;flex:1;min-width:160px">
        <button type="submit" style="padding:5px 12px;border-radius:4px;border:1px solid var(--border);background:var(--bg-2);color:var(--fg-1);font-size:12px;cursor:pointer">Filter</button>
      </form>
    </div>

    <div class="card">
      ${table(['Action', 'Model Class', 'Key', 'Changes', 'Origin', 'Time'], rows)}
    </div>

    ${pagination(basePath + '/models', page, totalPages, searchParams)}
  `

  return renderLayout({ title: 'Models', activePage: 'models', basePath, content })
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
