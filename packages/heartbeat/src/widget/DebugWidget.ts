/**
 * Floating debug widget — injected into HTML responses when APP_DEBUG=true.
 * Shows request duration, memory, status, query count, and links to Heartbeat.
 *
 * Renders as a small pill at bottom-right that expands on hover/click.
 * Minimal footprint — all inline, no external deps.
 */

export function renderWidget(data: {
  duration: number
  memory: number
  status: number
  queries: number
  dashboardPath: string
}): string {
  const { duration, memory, status, queries, dashboardPath } = data
  const memMB = (memory / 1024 / 1024).toFixed(1)
  const durationMs = duration.toFixed(0)
  const statusColor = status >= 500 ? '#f87171' : status >= 400 ? '#fbbf24' : '#34d399'

  return `<!-- mantiq:heartbeat-widget -->
<div id="__mantiq_widget" style="position:fixed;bottom:16px;right:16px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:12px;pointer-events:auto;">
  <div id="__mw_pill" style="display:flex;align-items:center;gap:8px;background:#0a0a0b;border:1px solid #27272a;border-radius:8px;padding:6px 12px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:all .2s ease;color:#a1a1aa;" onclick="document.getElementById('__mw_panel').style.display=document.getElementById('__mw_panel').style.display==='none'?'block':'none'">
    <span style="width:6px;height:6px;border-radius:50%;background:${statusColor};flex-shrink:0"></span>
    <span style="color:#fafafa;font-weight:600">${durationMs}ms</span>
    <span style="color:#52525b">·</span>
    <span>${memMB}MB</span>
    <span style="color:#52525b">·</span>
    <span>${queries}q</span>
    <span style="color:#34d399;font-size:10px;margin-left:2px">▲</span>
  </div>
  <div id="__mw_panel" style="display:none;position:absolute;bottom:calc(100% + 8px);right:0;background:#0a0a0b;border:1px solid #27272a;border-radius:10px;padding:0;min-width:260px;box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden;">
    <div style="padding:12px 14px;border-bottom:1px solid #1e1e1e;display:flex;align-items:center;justify-content:space-between;">
      <span style="color:#34d399;font-weight:600;font-size:11px;letter-spacing:.03em">● HEARTBEAT</span>
      <a href="${dashboardPath}" style="color:#52525b;text-decoration:none;font-size:11px;transition:color .15s" onmouseover="this.style.color='#34d399'" onmouseout="this.style.color='#52525b'">Dashboard →</a>
    </div>
    <div style="padding:10px 14px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <div style="color:#52525b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Duration</div>
        <div style="color:#fafafa;font-weight:600;font-size:14px">${durationMs}<span style="color:#52525b;font-size:11px;font-weight:400">ms</span></div>
      </div>
      <div>
        <div style="color:#52525b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Memory</div>
        <div style="color:#fafafa;font-weight:600;font-size:14px">${memMB}<span style="color:#52525b;font-size:11px;font-weight:400">MB</span></div>
      </div>
      <div>
        <div style="color:#52525b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Status</div>
        <div style="color:${statusColor};font-weight:600;font-size:14px">${status}</div>
      </div>
      <div>
        <div style="color:#52525b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Queries</div>
        <div style="color:#fafafa;font-weight:600;font-size:14px">${queries}</div>
      </div>
    </div>
    <div style="padding:8px 14px;border-top:1px solid #1e1e1e;">
      <a href="${dashboardPath}" style="display:block;text-align:center;color:#0a0a0b;background:#34d399;padding:6px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;transition:background .15s" onmouseover="this.style.background='#10b981'" onmouseout="this.style.background='#34d399'">Open Heartbeat</a>
    </div>
  </div>
</div>
<script>document.addEventListener('keydown',function(e){if(e.key==='Escape')document.getElementById('__mw_panel').style.display='none'});</script>
<!-- /mantiq:heartbeat-widget -->`
}
