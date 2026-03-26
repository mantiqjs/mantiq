import { renderLayout } from '../shared/layout.ts'
import { badge, durationBadge, timeAgo, escapeHtml } from '../shared/components.ts'
import { formatDuration } from '../../helpers/timing.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { CommandEntryContent, HeartbeatEntry } from '../../contracts/Entry.ts'

const TYPE_ICONS: Record<string, string> = {
  query: '\u26A1',
  cache: '\uD83D\uDCE6',
  event: '\u26A1',
  exception: '\uD83D\uDD34',
  log: '\uD83D\uDCDD',
  job: '\u2699\uFE0F',
  model: '\uD83D\uDD37',
  mail: '\u2709\uFE0F',
  schedule: '\u23F0',
}

const TYPE_COLORS: Record<string, string> = {
  query: '#818cf8',
  cache: '#34d399',
  exception: '#f87171',
  event: '#fbbf24',
  log: '#94a3b8',
  job: '#60a5fa',
  model: '#a78bfa',
  mail: '#2dd4bf',
  schedule: '#fb923c',
}

export async function renderCommandDetailPage(store: HeartbeatStore, uuid: string, basePath: string): Promise<string | null> {
  const entry = await store.getEntry(uuid)
  if (!entry || entry.type !== 'command') return null

  const c = JSON.parse(entry.content) as CommandEntryContent

  // Find related entries created during this command
  // The command's request_id is the commandId set by the tracer; child entries share this request_id
  const relatedEntries = entry.request_id
    ? (await store.getEntries({ requestId: entry.request_id, limit: 200 }))
        .filter((e) => e.uuid !== entry.uuid)
    : []

  const recorded = new Date(entry.created_at)
  const timeStr = `${recorded.getFullYear()}-${String(recorded.getMonth() + 1).padStart(2, '0')}-${String(recorded.getDate()).padStart(2, '0')} ${String(recorded.getHours()).padStart(2, '0')}:${String(recorded.getMinutes()).padStart(2, '0')}:${String(recorded.getSeconds()).padStart(2, '0')}`

  const argsEntries = Object.entries(c.arguments ?? {})
  const optionsEntries = Object.entries(c.options ?? {})

  const content = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13px">
      <a href="${basePath}" style="color:var(--fg-3);text-decoration:none">Overview</a>
      <span style="color:var(--fg-3)">&rsaquo;</span>
      <a href="${basePath}/commands" style="color:var(--fg-3);text-decoration:none">Commands</a>
      <span style="color:var(--fg-3)">&rsaquo;</span>
      <span style="color:var(--fg-1)">${escapeHtml(c.name)}</span>
    </div>

    <div class="card mb" style="padding:16px 18px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <code style="color:var(--fg-1);font-size:14px;font-weight:600;letter-spacing:-.01em">${escapeHtml(c.name)}</code>
        ${badge(String(c.exit_code), c.exit_code === 0 ? 'green' : 'red')}
        ${durationBadge(c.duration)}
        <span class="sm dim" style="flex-shrink:0">${timeStr}</span>
      </div>
      <div style="margin-top:8px">
        <code class="sm dim" style="font-size:11px">${entry.uuid}</code>
      </div>
    </div>

    <div class="stats">
      ${stat('Exit Code', String(c.exit_code))}
      ${stat('Duration', formatDuration(c.duration))}
      ${stat('Arguments', String(argsEntries.length))}
    </div>

    ${argsEntries.length > 0 || optionsEntries.length > 0 ? `<div class="card mb">
      <div class="card-title">Details</div>
      ${argsEntries.length > 0 ? `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:500;color:var(--fg-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Arguments</div>
        <div class="meta-grid">
          ${argsEntries.map(([k, v]) => `<div class="meta-item">
            <div class="meta-label">${escapeHtml(k)}</div>
            <div class="meta-value mono sm">${escapeHtml(typeof v === 'string' ? v : JSON.stringify(v))}</div>
          </div>`).join('')}
        </div>
      </div>` : ''}
      ${optionsEntries.length > 0 ? `<div>
        <div style="font-size:11px;font-weight:500;color:var(--fg-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Options</div>
        <div class="meta-grid">
          ${optionsEntries.map(([k, v]) => `<div class="meta-item">
            <div class="meta-label">${escapeHtml(k)}</div>
            <div class="meta-value mono sm">${escapeHtml(typeof v === 'string' ? v : JSON.stringify(v))}</div>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>` : ''}

    ${c.output ? `<div class="card mb">
      <div class="card-title">Output</div>
      <pre class="mono sm" style="background:var(--bg-2);padding:12px;border-radius:6px;overflow-x:auto;color:var(--fg-1);max-height:400px;overflow-y:auto;margin:0;white-space:pre-wrap">${escapeHtml(c.output)}</pre>
    </div>` : ''}

    ${renderRelatedEntries(relatedEntries)}

    <div style="margin-top:14px;font-size:11px;color:var(--fg-3)">${timeAgo(entry.created_at)}</div>
  `

  return renderLayout({ title: c.name, activePage: 'commands', basePath, content })
}

function stat(label: string, value: string): string {
  return `<div class="stat">
    <div class="stat-label">${label}</div>
    <div class="stat-val" style="font-size:15px">${escapeHtml(value)}</div>
  </div>`
}

// ── Related entries (queries, cache, events, logs, etc.) ─────────────────────

function renderRelatedEntries(entries: HeartbeatEntry[]): string {
  if (entries.length === 0) return ''

  const grouped = new Map<string, HeartbeatEntry[]>()
  for (const e of entries) {
    const list = grouped.get(e.type) ?? []
    list.push(e)
    grouped.set(e.type, list)
  }

  const order = ['query', 'exception', 'cache', 'log', 'event', 'job', 'model', 'mail', 'schedule']
  const sortedTypes = [...grouped.keys()].sort((a, b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  let sections = ''
  for (const type of sortedTypes) {
    const list = grouped.get(type)!
    const color = TYPE_COLORS[type] ?? 'var(--fg-3)'
    const icon = TYPE_ICONS[type] ?? '\u2022'
    const label = type.charAt(0).toUpperCase() + type.slice(1) + (list.length > 1 ? 's' : '')

    sections += `<div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span>${icon}</span>
        <span style="font-weight:600;font-size:12px;color:${color};text-transform:uppercase;letter-spacing:.04em">${escapeHtml(label)}</span>
        <span style="font-size:11px;color:var(--fg-3)">${list.length}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${list.map((e) => renderRelatedEntry(e, type)).join('')}
      </div>
    </div>`
  }

  return `<div class="card" style="margin-top:16px">
    <div class="card-title" style="margin-bottom:12px">Command Timeline</div>
    ${sections}
  </div>`
}

function renderRelatedEntry(entry: HeartbeatEntry, type: string): string {
  const content = JSON.parse(entry.content)
  const color = TYPE_COLORS[type] ?? 'var(--fg-3)'
  const ts = new Date(entry.created_at)
  const time = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}:${String(ts.getSeconds()).padStart(2, '0')}.${String(ts.getMilliseconds()).padStart(3, '0')}`

  let summary = ''
  let detail = ''

  switch (type) {
    case 'query':
      summary = escapeHtml(content.sql ?? content.normalized_sql ?? 'SQL query')
      detail = content.duration != null ? `${content.duration.toFixed(1)}ms` : ''
      if (content.slow) detail += ' <span style="color:#f87171;font-weight:600">SLOW</span>'
      if (content.n_plus_one) detail += ' <span style="color:#fbbf24;font-weight:600">N+1</span>'
      break
    case 'cache':
      summary = `${content.event ?? content.operation ?? 'operation'} \u2192 ${escapeHtml(content.key ?? '')}`
      break
    case 'event':
      summary = escapeHtml(content.event_class ?? content.event ?? 'event')
      detail = content.listeners_count != null ? `${content.listeners_count} listener${content.listeners_count === 1 ? '' : 's'}` : ''
      break
    case 'log':
      summary = escapeHtml(content.message ?? '')
      detail = content.level ?? ''
      break
    case 'exception':
      summary = escapeHtml(content.class ?? content.message ?? 'exception')
      detail = content.file ? escapeHtml(content.file + ':' + (content.line ?? '')) : ''
      break
    case 'job':
      summary = escapeHtml(content.job_name ?? content.job ?? 'job')
      detail = content.status ?? ''
      break
    case 'model':
      summary = `${content.action ?? 'action'} ${escapeHtml(content.model_class ?? content.model ?? '')}`
      detail = content.key ? `#${content.key}` : ''
      break
    case 'mail':
      summary = escapeHtml(content.subject ?? 'email')
      detail = content.to?.join(', ') ?? ''
      break
    default:
      summary = JSON.stringify(content).slice(0, 80)
  }

  return `<div style="display:flex;align-items:baseline;gap:8px;padding:5px 8px;background:var(--bg-2);border-radius:4px;font-size:12px">
    <code style="color:var(--fg-3);font-size:10px;flex-shrink:0">${time}</code>
    <span style="border-left:2px solid ${color};padding-left:8px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      <code style="color:var(--fg-1)">${summary}</code>
    </span>
    ${detail ? `<span style="color:var(--fg-3);font-size:11px;flex-shrink:0">${detail}</span>` : ''}
  </div>`
}
