/**
 * Shared HTML component helpers for the Heartbeat dashboard.
 */

export function stat(label: string, value: string | number, sub?: string): string {
  return `<div class="stat">
    <div class="stat-label">${label}</div>
    <div class="stat-val">${value}</div>
    ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
  </div>`
}

// Keep old name as alias for pages that import it
export const statCard = stat

export function badge(text: string, variant: 'green' | 'amber' | 'red' | 'blue' | 'mute' = 'mute'): string {
  return `<span class="b b-${variant}">${text}</span>`
}

export function statusBadge(status: number): string {
  if (status < 300) return badge(String(status), 'green')
  if (status < 400) return badge(String(status), 'blue')
  if (status < 500) return badge(String(status), 'amber')
  return badge(String(status), 'red')
}

export function methodBadge(method: string): string {
  const v: Record<string, 'green' | 'blue' | 'amber' | 'red'> = {
    GET: 'green', POST: 'blue', PUT: 'amber', PATCH: 'amber', DELETE: 'red',
  }
  return badge(method, v[method] ?? 'mute')
}

export function durationBadge(ms: number, threshold = 1000): string {
  const text = ms < 1 ? `${(ms * 1000).toFixed(0)}us` : ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`
  return `<span class="mono sm ${ms > threshold ? 'b b-red' : ms > threshold / 2 ? 'b b-amber' : 'muted'}">${text}</span>`
}

export function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return `<div class="empty">No data yet.</div>`
  }

  const thead = headers.map((h) => `<th>${h}</th>`).join('')
  const tbody = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('\n')

  return `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 1000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function truncate(str: string, maxLength = 80): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '\u2026'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`
}

export function pagination(total: number, page: number, perPage: number, baseUrl: string): string {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return ''

  const items: string[] = []

  // Previous
  if (page > 1) {
    items.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page - 1}">&laquo; Prev</a>`)
  } else {
    items.push('<span class="disabled">&laquo; Prev</span>')
  }

  // Page numbers (show max 7)
  const start = Math.max(1, page - 3)
  const end = Math.min(totalPages, start + 6)
  for (let i = start; i <= end; i++) {
    if (i === page) {
      items.push(`<span class="active">${i}</span>`)
    } else {
      items.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${i}">${i}</a>`)
    }
  }

  // Next
  if (page < totalPages) {
    items.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page + 1}">Next &raquo;</a>`)
  } else {
    items.push('<span class="disabled">Next &raquo;</span>')
  }

  return `<div class="pagination">${items.join('')}</div>`
}

export function filterBar(options: {
  action: string
  searchPlaceholder?: string
  searchValue?: string
  filters?: Array<{ name: string; label: string; options: Array<{ value: string; label: string }>; selected?: string }>
}): string {
  const parts: string[] = [`<form class="filter-bar" method="get" action="${escapeHtml(options.action)}">`]

  if (options.searchPlaceholder) {
    parts.push(`<input type="text" name="search" placeholder="${escapeHtml(options.searchPlaceholder)}" value="${escapeHtml(options.searchValue ?? '')}" />`)
  }

  if (options.filters) {
    for (const filter of options.filters) {
      parts.push(`<select name="${escapeHtml(filter.name)}" onchange="this.form.submit()">`)
      parts.push(`<option value="">${escapeHtml(filter.label)}</option>`)
      for (const opt of filter.options) {
        const sel = opt.value === filter.selected ? ' selected' : ''
        parts.push(`<option value="${escapeHtml(opt.value)}"${sel}>${escapeHtml(opt.label)}</option>`)
      }
      parts.push('</select>')
    }
  }

  parts.push('<button type="submit" style="background:var(--bg-2);border:1px solid var(--border-0);border-radius:6px;padding:6px 12px;font-size:12px;color:var(--fg-1);cursor:pointer">Filter</button>')
  parts.push('</form>')
  return parts.join('')
}

export function breadcrumbs(items: Array<{ label: string; href?: string }>): string {
  return '<div class="breadcrumbs">' + items.map((item, i) => {
    if (i === items.length - 1 || !item.href) {
      return `<span>${escapeHtml(item.label)}</span>`
    }
    return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a><span class="sep">/</span>`
  }).join('') + '</div>'
}

export function emptyState(icon: string, title: string, description: string): string {
  return `<div class="empty-state"><div class="icon">${icon}</div><div class="title">${escapeHtml(title)}</div><div class="desc">${escapeHtml(description)}</div></div>`
}

export function collapsibleSection(title: string, count: number, color: string, content: string, defaultOpen = true): string {
  const openClass = defaultOpen ? ' open' : ''
  return `<div class="collapsible">
    <div class="collapsible-header${openClass}" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
      <span class="chevron">&#9654;</span>
      <span style="color:${color};font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(title)}</span>
      <span style="font-size:11px;color:var(--fg-3)">${count}</span>
    </div>
    <div class="collapsible-body${openClass}">${content}</div>
  </div>`
}

export function sqlHighlight(sql: string): string {
  const keywords = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|COUNT|SUM|AVG|MIN|MAX|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|ASC|DESC|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CHECK|CONSTRAINT|TRANSACTION|BEGIN|COMMIT|ROLLBACK)\b/gi
  const strings = /('[^']*')/g
  const nums = /\b(\d+(?:\.\d+)?)\b/g

  let result = escapeHtml(sql)
  result = result.replace(strings, '<span class="sql-str">$1</span>')
  result = result.replace(keywords, '<span class="sql-kw">$1</span>')
  result = result.replace(nums, '<span class="sql-num">$1</span>')
  return result
}

export function diffView(changes: Record<string, { old: any; new: any }> | null): string {
  if (!changes || Object.keys(changes).length === 0) return '<span style="color:var(--fg-3)">No changes</span>'

  const rows = Object.entries(changes).map(([key, { old: oldVal, new: newVal }]) => {
    const o = oldVal === null || oldVal === undefined ? 'null' : String(oldVal)
    const n = newVal === null || newVal === undefined ? 'null' : String(newVal)
    return `<tr><td style="font-weight:500">${escapeHtml(key)}</td><td style="color:#f87171;text-decoration:line-through">${escapeHtml(o)}</td><td style="color:#34d399">${escapeHtml(n)}</td></tr>`
  })

  return `<table class="tbl" style="font-size:11px"><thead><tr><th>Field</th><th>Old</th><th>New</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
}

export function waterfallChart(items: Array<{ label: string; start: number; end: number; color: string }>, totalDuration: number): string {
  if (items.length === 0 || totalDuration <= 0) return ''

  const rows = items.map((item) => {
    const left = (item.start / totalDuration) * 100
    const width = Math.max(((item.end - item.start) / totalDuration) * 100, 0.5)
    const dur = (item.end - item.start).toFixed(1)
    return `<div class="waterfall-row">
      <div class="waterfall-label" title="${escapeHtml(item.label)}">${escapeHtml(truncate(item.label, 18))}</div>
      <div class="waterfall-track"><div class="waterfall-bar" style="left:${left}%;width:${width}%;background:${item.color}"></div></div>
      <div class="waterfall-dur">${dur}ms</div>
    </div>`
  })

  return `<div class="waterfall">${rows.join('')}</div>`
}

export function originBadge(originType: string, originId: string | null, basePath: string): string {
  if (!originId) return '<span style="color:var(--fg-3);font-size:11px">standalone</span>'

  const colors: Record<string, string> = { request: '#818cf8', command: '#fb923c', schedule: '#fbbf24', job: '#60a5fa' }
  const color = colors[originType] ?? 'var(--fg-3)'
  const shortId = originId.slice(0, 8)
  const href = originType === 'request' ? `${basePath}/requests/${originId}` : originType === 'command' ? `${basePath}/commands/${originId}` : '#'

  return `<a href="${href}" style="font-size:11px;color:${color};text-decoration:none;border:1px solid ${color};border-radius:4px;padding:1px 6px" title="${escapeHtml(originId)}">${escapeHtml(originType)}:${shortId}</a>`
}
