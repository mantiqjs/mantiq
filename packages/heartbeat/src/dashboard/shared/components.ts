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
