import { renderLayout } from '../shared/layout.ts'
import { durationBadge, timeAgo, escapeHtml, badge } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { MailEntryContent } from '../../contracts/Entry.ts'

export async function renderMailPage(store: HeartbeatStore, basePath: string): Promise<string> {
  const entries = await store.getEntries('mail', 50)

  const rows = entries.map((e) => {
    const c = JSON.parse(e.content) as MailEntryContent
    const to = c.to.length > 2
      ? `${escapeHtml(c.to.slice(0, 2).join(', '))} +${c.to.length - 2}`
      : escapeHtml(c.to.join(', '))

    return `<tr>
      <td style="padding:10px 14px">
        <a href="${basePath}/mail/${e.uuid}" style="color:var(--fg-0);text-decoration:none;font-weight:500">${escapeHtml(c.subject || '(no subject)')}</a>
      </td>
      <td class="mono sm" style="padding:10px 14px;color:var(--fg-2)">${to}</td>
      <td style="padding:10px 14px">${badge(c.mailer, 'mute')}</td>
      <td style="padding:10px 14px">${c.queued ? badge('queued', 'amber') : badge('sent', 'green')}</td>
      <td style="padding:10px 14px">${durationBadge(c.duration)}</td>
      <td class="sm dim" style="padding:10px 14px;text-align:right">${timeAgo(e.created_at)}</td>
    </tr>`
  }).join('')

  const empty = entries.length === 0
    ? `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--fg-3)">No mail entries recorded yet</td></tr>`
    : ''

  const content = `
    <div class="card">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th class="th">Subject</th>
            <th class="th">To</th>
            <th class="th">Mailer</th>
            <th class="th">Status</th>
            <th class="th">Duration</th>
            <th class="th" style="text-align:right">Time</th>
          </tr>
        </thead>
        <tbody>${rows}${empty}</tbody>
      </table>
    </div>
  `

  return renderLayout({ title: 'Mail', activePage: 'mail', basePath, content })
}
