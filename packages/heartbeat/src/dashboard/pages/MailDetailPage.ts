import { renderLayout } from '../shared/layout.ts'
import { badge, durationBadge, escapeHtml } from '../shared/components.ts'
import type { HeartbeatStore } from '../../storage/HeartbeatStore.ts'
import type { MailEntryContent } from '../../contracts/Entry.ts'

export async function renderMailDetailPage(store: HeartbeatStore, uuid: string, basePath: string): Promise<string | null> {
  const entry = await store.getEntry(uuid)
  if (!entry || entry.type !== 'mail') return null

  const c = JSON.parse(entry.content) as MailEntryContent
  const recorded = new Date(entry.created_at)
  const timeStr = `${recorded.getFullYear()}-${String(recorded.getMonth() + 1).padStart(2, '0')}-${String(recorded.getDate()).padStart(2, '0')} ${String(recorded.getHours()).padStart(2, '0')}:${String(recorded.getMinutes()).padStart(2, '0')}:${String(recorded.getSeconds()).padStart(2, '0')}`

  const attachmentsList = c.attachments.length > 0
    ? c.attachments.map(a => `<span class="mono sm" style="padding:4px 8px;background:var(--bg-2);border-radius:4px;font-size:11px">${escapeHtml(a)}</span>`).join(' ')
    : '<span class="dim sm">None</span>'

  const content = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <a href="${basePath}/mail" style="color:var(--fg-3);text-decoration:none;font-size:13px">&larr; Mail</a>
    </div>

    <div class="card mb" style="padding:16px 18px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="color:var(--fg-0);font-size:15px;font-weight:600">${escapeHtml(c.subject || '(no subject)')}</span>
        ${c.queued ? badge('queued', 'amber') : badge('sent', 'green')}
        ${badge(c.mailer, 'mute')}
        ${durationBadge(c.duration)}
      </div>
      <div class="sm dim" style="margin-top:6px">${timeStr}</div>
    </div>

    <div class="card mb">
      <div class="card-title">Details</div>
      <div class="meta-grid">
        <div class="meta-item">
          <div class="meta-label">From</div>
          <div class="meta-value mono sm">${escapeHtml(c.from)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">To</div>
          <div class="meta-value mono sm">${escapeHtml(c.to.join(', '))}</div>
        </div>
        ${c.cc.length > 0 ? `<div class="meta-item">
          <div class="meta-label">CC</div>
          <div class="meta-value mono sm">${escapeHtml(c.cc.join(', '))}</div>
        </div>` : ''}
        ${c.bcc.length > 0 ? `<div class="meta-item">
          <div class="meta-label">BCC</div>
          <div class="meta-value mono sm">${escapeHtml(c.bcc.join(', '))}</div>
        </div>` : ''}
        <div class="meta-item">
          <div class="meta-label">Attachments</div>
          <div class="meta-value">${attachmentsList}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="tabs">
        <input type="radio" name="mail-tab" id="tab-html" checked>
        <label for="tab-html">HTML Preview</label>
        <input type="radio" name="mail-tab" id="tab-source">
        <label for="tab-source">Source</label>
        <input type="radio" name="mail-tab" id="tab-text">
        <label for="tab-text">Plain Text</label>
      </div>

      <div class="tab-panel" id="panel-html" style="padding:0">
        ${c.html
          ? `<iframe id="mail-preview" srcdoc="${escapeAttr(c.html)}" style="width:100%;border:none;min-height:500px;background:#fff;border-radius:0 0 8px 8px" onload="this.style.height=this.contentDocument.body.scrollHeight+'px'"></iframe>`
          : `<div style="padding:40px;text-align:center;color:var(--fg-3)">No HTML content</div>`
        }
      </div>

      <div class="tab-panel" id="panel-source" style="padding:14px 0 0">
        <pre class="code-block" style="max-height:500px;overflow:auto">${escapeHtml(c.html ?? '(no HTML)')}</pre>
      </div>

      <div class="tab-panel" id="panel-text" style="padding:14px 18px">
        <pre style="white-space:pre-wrap;font-family:var(--font-mono, monospace);font-size:13px;color:var(--fg-1);line-height:1.6">${escapeHtml(c.text ?? '(no plain text)')}</pre>
      </div>
    </div>

    <script>
    (function() {
      var tabs = document.querySelectorAll('[name="mail-tab"]');
      var panels = {
        'tab-html': document.getElementById('panel-html'),
        'tab-source': document.getElementById('panel-source'),
        'tab-text': document.getElementById('panel-text'),
      };
      function show() {
        for (var id in panels) { panels[id].style.display = 'none'; }
        for (var t of tabs) {
          if (t.checked) { panels[t.id].style.display = 'block'; }
        }
      }
      for (var t of tabs) t.addEventListener('change', show);
      show();
    })();
    </script>
  `

  return renderLayout({ title: 'Mail Detail', activePage: 'mail', basePath, content })
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
