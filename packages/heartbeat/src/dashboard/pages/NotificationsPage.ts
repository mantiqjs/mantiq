import { renderLayout } from '../shared/layout.ts'
import { table, badge, timeAgo, escapeHtml, stat } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'

const PER_PAGE = 50

interface NotificationContent {
  type: string
  channel: string
  notifiable: string
  status: string
}

export async function renderNotificationsPage(store: HeartbeatStore, basePath: string, searchParams?: URLSearchParams): Promise<string> {
  const page = Math.max(1, parseInt(searchParams?.get('page') ?? '1', 10))

  // Notifications are stored as 'notification' type entries when @mantiq/notify is installed
  const entries = await store.getEntries({ type: 'notification' as any, limit: PER_PAGE, offset: (page - 1) * PER_PAGE })
  const total = await store.countEntries('notification' as any)

  if (entries.length === 0) {
    const content = `
      <div class="stats">
        ${stat('Total Sent', '0')}
      </div>
      <div class="card">
        <div class="empty" style="padding:48px 16px">
          <div style="font-size:14px;color:var(--fg-2);margin-bottom:6px">No notifications recorded</div>
          <div style="font-size:12px;color:var(--fg-3)">Notifications are tracked when <code>@mantiq/notify</code> is installed.</div>
        </div>
      </div>
    `
    return renderLayout({ title: 'Notifications', activePage: 'notifications', basePath, content })
  }

  const rows = entries.map((entry) => {
    let c: NotificationContent
    try { c = JSON.parse(entry.content) } catch { return [] }

    const statusVariant = c.status === 'sent' ? 'green' : c.status === 'failed' ? 'red' : 'mute'

    return [
      `<span class="mono sm">${escapeHtml(c.type ?? '--')}</span>`,
      `<span class="sm muted">${escapeHtml(c.channel ?? '--')}</span>`,
      `<span class="sm muted">${escapeHtml(c.notifiable ?? '--')}</span>`,
      badge(c.status ?? 'unknown', statusVariant as any),
      `<span class="sm dim">${timeAgo(entry.created_at)}</span>`,
    ]
  }).filter((row) => row.length > 0)

  const totalPages = Math.ceil(total / PER_PAGE)

  const content = `
    <div class="stats">
      ${stat('Total Sent', total.toString())}
    </div>

    <div class="card">
      ${table(['Type', 'Channel', 'Notifiable', 'Status', 'Time'], rows)}
    </div>

    ${pagination(basePath + '/notifications', page, totalPages, searchParams)}
  `

  return renderLayout({ title: 'Notifications', activePage: 'notifications', basePath, content })
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
