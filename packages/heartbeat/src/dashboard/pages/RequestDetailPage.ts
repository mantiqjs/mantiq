import { renderLayout } from '../shared/layout.ts'
import { statusBadge, methodBadge, durationBadge, timeAgo, escapeHtml, formatBytes } from '../shared/components.ts'
import { formatDuration } from '../../helpers/timing.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { RequestEntryContent, HeartbeatEntry } from '../../contracts/Entry.ts'

const COPY_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
const CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

export async function renderRequestDetailPage(store: HeartbeatStore, uuid: string, basePath: string): Promise<string | null> {
  const entry = await store.getEntry(uuid)
  if (!entry || entry.type !== 'request') return null

  const c = JSON.parse(entry.content) as RequestEntryContent

  // Fetch all entries that share this request_id (queries, cache, events, logs, exceptions, etc.)
  const relatedEntries = entry.request_id
    ? (await store.getEntries({ requestId: entry.request_id, limit: 200 }))
        .filter((e) => e.uuid !== entry.uuid)
    : []

  const recorded = new Date(entry.created_at)
  const timeStr = `${recorded.getFullYear()}-${String(recorded.getMonth() + 1).padStart(2, '0')}-${String(recorded.getDate()).padStart(2, '0')} ${String(recorded.getHours()).padStart(2, '0')}:${String(recorded.getMinutes()).padStart(2, '0')}:${String(recorded.getSeconds()).padStart(2, '0')}`
  const requestLine = `${c.method} ${c.url || c.path}`

  // Build request tab sections
  const requestSections: string[] = []
  requestSections.push(kvTable('Headers', c.request_headers))
  if (c.request_query && Object.keys(c.request_query).length > 0) {
    requestSections.push(kvTable('Query Parameters', c.request_query))
  }
  if (c.request_body) {
    requestSections.push(subsection('Body', jsonBlock(c.request_body)))
  }
  if (c.request_cookies && Object.keys(c.request_cookies).length > 0) {
    requestSections.push(kvTable('Cookies', c.request_cookies))
  }

  // Build response tab sections
  const responseSections: string[] = []
  responseSections.push(kvTable('Headers', c.response_headers ?? {}))
  if (c.response_body) {
    responseSections.push(subsection('Body', jsonBlock(tryParse(c.response_body))))
  }

  // Meta items for the details card
  const metaItems = [
    ['Controller', c.controller],
    ['Route', c.route_name],
    ['IP Address', c.ip],
    ['User ID', c.user_id != null ? String(c.user_id) : null],
    ['Middleware', c.middleware?.length > 0 ? c.middleware.join(' → ') : null],
  ].filter(([, v]) => v != null) as [string, string][]

  // Build markdown for "Copy as Markdown"
  const md = buildMarkdown(entry.uuid, c, timeStr, metaItems)
  // Escape for embedding in JS string
  const mdEscaped = md.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')

  const content = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <a href="${basePath}/requests" style="color:var(--fg-3);text-decoration:none;font-size:13px;display:flex;align-items:center;gap:4px">&larr; <span>Requests</span></a>
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
        <button class="copy-btn" onclick="copyMd()" title="Copy full request as Markdown">${COPY_ICON}<span>Copy as Markdown</span></button>
      </div>
    </div>

    <div class="card mb" style="padding:16px 18px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <code style="color:var(--fg-1);font-size:14px;font-weight:600;letter-spacing:-.01em">${escapeHtml(requestLine)}</code>
        ${statusBadge(c.status)}
        ${durationBadge(c.duration)}
        <span class="sm dim" style="flex-shrink:0">${timeStr}</span>
        <button class="copy-btn" onclick="copyText('${escapeHtml(requestLine)}', this)" title="Copy request" style="margin-left:auto">${COPY_ICON}</button>
      </div>
      <div style="margin-top:8px">
        <code class="sm dim" style="font-size:11px">${entry.uuid}</code>
      </div>
    </div>

    <div class="stats">
      ${stat('Status', String(c.status))}
      ${stat('Duration', formatDuration(c.duration))}
      ${stat('Memory', c.memory_usage > 0 ? formatBytes(c.memory_usage) : '--')}
      ${stat('Response Size', c.response_size != null ? formatBytes(c.response_size) : '--')}
    </div>

    ${metaItems.length > 0 ? `<div class="card mb">
      <div class="card-title">Details</div>
      <div class="meta-grid">
        ${metaItems.map(([label, value]) => `<div class="meta-item">
          <div class="meta-label">${label}</div>
          <div class="meta-value${label === 'Middleware' ? ' mono sm' : ''}">${escapeHtml(value)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="card">
      <div class="tabs">
        <input type="radio" name="detail-tab" id="tab-request" checked>
        <label for="tab-request">Request</label>
        <input type="radio" name="detail-tab" id="tab-response">
        <label for="tab-response">Response</label>
      </div>
      <div class="tab-panel" id="panel-request" style="padding:14px 0 0">
        ${requestSections.join('')}
      </div>
      <div class="tab-panel" id="panel-response" style="padding:14px 0 0">
        ${responseSections.join('')}
      </div>
    </div>

    ${renderRelatedEntries(relatedEntries, basePath)}

    <div style="margin-top:14px;font-size:11px;color:var(--fg-3)">${timeAgo(entry.created_at)}</div>

    <script>
      // Tab switching
      document.querySelectorAll('.tabs input[type="radio"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
          var card = this.closest('.card');
          card.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
          var id = this.id.replace('tab-', 'panel-');
          var panel = card.querySelector('#' + id);
          if (panel) panel.classList.add('active');
        });
      });
      // Activate first tab on load
      document.querySelectorAll('.card').forEach(function(card) {
        var first = card.querySelector('.tabs input[type="radio"]:checked');
        if (first) {
          var id = first.id.replace('tab-', 'panel-');
          var panel = card.querySelector('#' + id);
          if (panel) panel.classList.add('active');
        }
      });

      function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(function() {
          btn.innerHTML = '${CHECK_ICON.replace(/'/g, "\\'")} Copied';
          btn.classList.add('copied');
          setTimeout(function() {
            btn.innerHTML = '${COPY_ICON.replace(/'/g, "\\'")} Copy';
            btn.classList.remove('copied');
          }, 1500);
        });
      }

      function copyMd() {
        var md = \`${mdEscaped}\`;
        navigator.clipboard.writeText(md).then(function() {
          var btn = document.querySelector('[onclick="copyMd()"]');
          btn.innerHTML = '${CHECK_ICON.replace(/'/g, "\\'")} <span>Copied</span>';
          btn.classList.add('copied');
          setTimeout(function() {
            btn.innerHTML = '${COPY_ICON.replace(/'/g, "\\'")} <span>Copy as Markdown</span>';
            btn.classList.remove('copied');
          }, 1500);
        });
      }
    </script>
  `

  return renderLayout({ title: `${c.method} ${c.path}`, activePage: 'requests', basePath, content })
}

function stat(label: string, value: string): string {
  return `<div class="stat">
    <div class="stat-label">${label}</div>
    <div class="stat-val" style="font-size:15px">${escapeHtml(value)}</div>
  </div>`
}

function subsection(title: string, body: string): string {
  return `<div style="margin-top:14px">
    <div class="card-title">${title}</div>
    ${body}
  </div>`
}

function kvTable(title: string, data: Record<string, string>): string {
  const entries = Object.entries(data)
  if (entries.length === 0) return `<div style="margin-top:14px"><div class="card-title">${title}</div><div class="empty">None</div></div>`

  const rows = entries.map(([k, v]) =>
    `<tr>
      <td class="mono sm" style="width:220px;color:var(--fg-3);white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td>
      <td class="mono sm" style="word-break:break-all">${escapeHtml(v)}</td>
    </tr>`
  ).join('')

  return `<div style="margin-top:14px">
    <div class="card-title">${title}</div>
    <table><tbody>${rows}</tbody></table>
  </div>`
}

function jsonBlock(data: any): string {
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return `<pre class="mono sm" style="background:var(--bg-2);padding:12px;border-radius:6px;overflow-x:auto;color:var(--fg-1);max-height:400px;overflow-y:auto;margin:0">${escapeHtml(json)}</pre>`
}

function tryParse(str: string): any {
  try { return JSON.parse(str) } catch { return str }
}

// ── Markdown export ─────────────────────────────────────────────────────────

function buildMarkdown(
  uuid: string,
  c: RequestEntryContent,
  timeStr: string,
  metaItems: [string, string][],
): string {
  const lines: string[] = []

  lines.push(`# ${c.method} ${c.url || c.path}`)
  lines.push('')
  lines.push(`**ID:** \`${uuid}\`  `)
  lines.push(`**Status:** ${c.status}  `)
  lines.push(`**Duration:** ${formatDuration(c.duration)}  `)
  if (c.memory_usage > 0) lines.push(`**Memory:** ${formatBytes(c.memory_usage)}  `)
  if (c.response_size != null) lines.push(`**Response Size:** ${formatBytes(c.response_size)}  `)
  lines.push(`**Recorded:** ${timeStr}`)
  lines.push('')

  if (metaItems.length > 0) {
    lines.push('## Details')
    lines.push('')
    for (const [label, value] of metaItems) {
      lines.push(`- **${label}:** ${value}`)
    }
    lines.push('')
  }

  lines.push('## Request')
  lines.push('')
  if (c.request_headers && Object.keys(c.request_headers).length > 0) {
    lines.push('### Headers')
    lines.push('')
    lines.push('| Key | Value |')
    lines.push('|-----|-------|')
    for (const [k, v] of Object.entries(c.request_headers)) {
      lines.push(`| \`${k}\` | \`${v}\` |`)
    }
    lines.push('')
  }
  if (c.request_query && Object.keys(c.request_query).length > 0) {
    lines.push('### Query Parameters')
    lines.push('')
    lines.push('| Key | Value |')
    lines.push('|-----|-------|')
    for (const [k, v] of Object.entries(c.request_query)) {
      lines.push(`| \`${k}\` | \`${v}\` |`)
    }
    lines.push('')
  }
  if (c.request_body) {
    lines.push('### Body')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(c.request_body, null, 2))
    lines.push('```')
    lines.push('')
  }
  if (c.request_cookies && Object.keys(c.request_cookies).length > 0) {
    lines.push('### Cookies')
    lines.push('')
    lines.push('| Key | Value |')
    lines.push('|-----|-------|')
    for (const [k, v] of Object.entries(c.request_cookies)) {
      lines.push(`| \`${k}\` | \`${v}\` |`)
    }
    lines.push('')
  }

  lines.push('## Response')
  lines.push('')
  if (c.response_headers && Object.keys(c.response_headers).length > 0) {
    lines.push('### Headers')
    lines.push('')
    lines.push('| Key | Value |')
    lines.push('|-----|-------|')
    for (const [k, v] of Object.entries(c.response_headers)) {
      lines.push(`| \`${k}\` | \`${v}\` |`)
    }
    lines.push('')
  }
  if (c.response_body) {
    lines.push('### Body')
    lines.push('')
    lines.push('```json')
    try {
      lines.push(JSON.stringify(JSON.parse(c.response_body), null, 2))
    } catch {
      lines.push(c.response_body)
    }
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

// ── Related entries (queries, cache, events, logs, etc.) ─────────────────────

const TYPE_ICONS: Record<string, string> = {
  query: '⚡',
  cache: '📦',
  event: '⚡',
  exception: '🔴',
  log: '📝',
  job: '⚙️',
  model: '🔷',
  mail: '✉️',
  schedule: '⏰',
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

function renderRelatedEntries(entries: HeartbeatEntry[], _basePath: string): string {
  if (entries.length === 0) return ''

  const grouped = new Map<string, HeartbeatEntry[]>()
  for (const e of entries) {
    const list = grouped.get(e.type) ?? []
    list.push(e)
    grouped.set(e.type, list)
  }

  // Preferred display order
  const order = ['query', 'exception', 'cache', 'log', 'event', 'job', 'model', 'mail', 'schedule']
  const sortedTypes = [...grouped.keys()].sort((a, b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  let sections = ''
  for (const type of sortedTypes) {
    const list = grouped.get(type)!
    const color = TYPE_COLORS[type] ?? 'var(--fg-3)'
    const icon = TYPE_ICONS[type] ?? '•'
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
    <div class="card-title" style="margin-bottom:12px">Request Timeline</div>
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
      summary = `${content.event ?? 'operation'} → ${escapeHtml(content.key ?? '')}`
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
      summary = `${content.action ?? 'action'} ${escapeHtml(content.model ?? '')}`
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
