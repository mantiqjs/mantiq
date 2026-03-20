/**
 * Full HTML shell for Heartbeat dashboard pages.
 * Self-contained: all CSS inline, no external dependencies.
 * Dark-first design inspired by Linear/Vercel.
 */
export function renderLayout(options: {
  title: string
  activePage: string
  basePath: string
  content: string
}): string {
  const { title, activePage, basePath, content } = options

  const pages = [
    { key: 'overview', label: 'Overview', icon: ICONS.grid },
    { key: 'requests', label: 'Requests', icon: ICONS.arrow },
    { key: 'queries', label: 'Queries', icon: ICONS.db },
    { key: 'exceptions', label: 'Exceptions', icon: ICONS.alert },
    { key: 'jobs', label: 'Jobs', icon: ICONS.layers },
    { key: 'cache', label: 'Cache', icon: ICONS.box },
    { key: 'events', label: 'Events', icon: ICONS.zap },
    { key: 'mail', label: 'Mail', icon: ICONS.mail },
    { key: 'performance', label: 'Performance', icon: ICONS.activity },
  ]

  const nav = pages
    .map((p) => {
      const cls = p.key === activePage ? ' class="active"' : ''
      const href = p.key === 'overview' ? basePath : `${basePath}/${p.key}`
      return `<a href="${href}"${cls}>${p.icon}<span>${p.label}</span></a>`
    })
    .join('\n        ')

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Heartbeat</title>
  <style>${CSS}</style>
</head>
<body>
  <aside class="sidebar">
    <div class="brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <span>Heartbeat</span>
    </div>
    <nav>${nav}</nav>
    <div class="sidebar-footer">
      <span class="sidebar-brand-footer"><span style="color:var(--accent)">●</span> mantiq</span>
    </div>
  </aside>
  <main>
    <div class="topbar">
      <h1 class="page-title">${title}</h1>
      <button class="theme-btn" onclick="toggleTheme()" title="Toggle theme">${ICONS.moon}</button>
    </div>
    ${content}
  </main>
  <script>
    (function(){
      var s=localStorage.getItem('hb-theme');
      var d=window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';
      var t=s||d;
      document.documentElement.setAttribute('data-theme',t);
    })();
    function toggleTheme(){
      var c=document.documentElement.getAttribute('data-theme');
      var n=c==='dark'?'light':'dark';
      document.documentElement.setAttribute('data-theme',n);
      localStorage.setItem('hb-theme',n);
    }
  </script>
</body>
</html>`
}

// ── SVG Icons (16x16, stroke-based) ─────────────────────────────────────────

const ICONS = {
  grid: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  arrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  db: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  alert: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  layers: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  box: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  zap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  activity: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  mail: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  moon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
}

// ── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
:root,[data-theme="light"]{
  --bg-0:#fff;--bg-1:#f9fafb;--bg-2:#f3f4f6;--bg-3:#e5e7eb;
  --fg-0:#111827;--fg-1:#374151;--fg-2:#6b7280;--fg-3:#9ca3af;
  --border:#e5e7eb;--ring:rgba(16,185,129,.25);
  --accent:#10b981;--accent-soft:rgba(16,185,129,.1);
  --green:#16a34a;--green-soft:rgba(22,163,74,.1);
  --amber:#d97706;--amber-soft:rgba(217,119,6,.1);
  --red:#dc2626;--red-soft:rgba(220,38,38,.1);
  --blue:#2563eb;--blue-soft:rgba(37,99,235,.1);
}
[data-theme="dark"]{
  --bg-0:#0a0a0b;--bg-1:#111113;--bg-2:#1a1a1d;--bg-3:#27272a;
  --fg-0:#fafafa;--fg-1:#d4d4d8;--fg-2:#71717a;--fg-3:#52525b;
  --border:#27272a;--ring:rgba(52,211,153,.3);
  --accent:#34d399;--accent-soft:rgba(52,211,153,.1);
  --green:#4ade80;--green-soft:rgba(74,222,128,.08);
  --amber:#fbbf24;--amber-soft:rgba(251,191,36,.08);
  --red:#f87171;--red-soft:rgba(248,113,113,.08);
  --blue:#60a5fa;--blue-soft:rgba(96,165,250,.08);
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
  font-size:14px;line-height:1.5;color:var(--fg-0);background:var(--bg-0);
  display:flex;min-height:100vh;-webkit-font-smoothing:antialiased;
}

/* Sidebar */
.sidebar{
  width:200px;background:var(--bg-1);border-right:1px solid var(--border);
  display:flex;flex-direction:column;position:fixed;top:0;bottom:0;z-index:10;
}
.brand{
  padding:16px 14px;font-size:14px;font-weight:600;color:var(--fg-0);
  display:flex;align-items:center;gap:8px;letter-spacing:-.02em;
}
.brand svg{color:var(--accent)}
.sidebar nav{padding:4px 6px;flex:1}
.sidebar nav a{
  display:flex;align-items:center;gap:8px;
  padding:6px 10px;border-radius:6px;margin:1px 0;
  color:var(--fg-2);text-decoration:none;font-size:13px;
  transition:color .1s,background .1s;
}
.sidebar nav a span{flex:1}
.sidebar nav a svg{flex-shrink:0;opacity:.6}
.sidebar nav a:hover{color:var(--fg-0);background:var(--bg-2)}
.sidebar nav a:hover svg{opacity:1}
.sidebar nav a.active{color:var(--fg-0);background:var(--bg-2);font-weight:500}
.sidebar nav a.active svg{opacity:1;color:var(--accent)}
.sidebar-footer{
  border-top:1px solid var(--border);padding:10px 14px;
  display:flex;align-items:center;justify-content:space-between;
}
.sidebar-brand-footer{
  font-size:11px;font-weight:500;color:var(--fg-3);opacity:.4;
  font-family:'SF Mono',ui-monospace,'Cascadia Mono',Menlo,monospace;
}
.theme-btn{
  all:unset;color:var(--fg-3);cursor:pointer;display:flex;align-items:center;
  padding:4px;border-radius:4px;
}
.theme-btn:hover{color:var(--fg-1)}

/* Main */
main{margin-left:200px;flex:1;padding:24px 28px;max-width:1200px;position:relative}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.page-title{font-size:18px;font-weight:600;letter-spacing:-.02em;color:var(--fg-0);margin:0}

/* Cards */
.card{
  background:var(--bg-1);border:1px solid var(--border);
  border-radius:8px;padding:14px 16px;margin-bottom:14px;
}
.card-title{
  font-size:11px;font-weight:500;color:var(--fg-3);
  text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;
}

/* Stat grid */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:18px}
.stat{background:var(--bg-1);border:1px solid var(--border);border-radius:8px;padding:14px 16px}
.stat-label{font-size:11px;font-weight:500;color:var(--fg-3);text-transform:uppercase;letter-spacing:.06em}
.stat-val{font-size:24px;font-weight:600;letter-spacing:-.03em;margin-top:4px;color:var(--fg-0);font-variant-numeric:tabular-nums}
.stat-sub{font-size:11px;color:var(--fg-3);margin-top:2px}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{
  text-align:left;padding:6px 10px;font-size:11px;font-weight:500;
  color:var(--fg-3);text-transform:uppercase;letter-spacing:.04em;
  border-bottom:1px solid var(--border);
}
tbody td{padding:8px 10px;border-bottom:1px solid var(--border);color:var(--fg-1);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--bg-2)}

/* Badges */
.b{
  display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;
  font-size:11px;font-weight:500;line-height:18px;white-space:nowrap;
}
.b-green{background:var(--green-soft);color:var(--green)}
.b-amber{background:var(--amber-soft);color:var(--amber)}
.b-red{background:var(--red-soft);color:var(--red)}
.b-blue{background:var(--blue-soft);color:var(--blue)}
.b-mute{background:var(--bg-3);color:var(--fg-2)}

/* Tabs */
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:0}
.tabs input[type="radio"]{display:none}
.tabs label{
  padding:8px 16px;font-size:13px;font-weight:500;color:var(--fg-3);
  cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;
  transition:color .1s,border-color .1s;
}
.tabs label:hover{color:var(--fg-1)}
.tabs input[type="radio"]:checked+label{color:var(--fg-0);border-bottom-color:var(--accent)}
.tab-panel{display:none;padding:14px 0 0}
.tab-panel.active{display:block}

/* Detail meta */
.meta-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0;
}
.meta-item{padding:10px 14px;border-bottom:1px solid var(--border)}
.meta-item:last-child{border-bottom:none}
.meta-label{font-size:11px;font-weight:500;color:var(--fg-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
.meta-value{font-size:13px;color:var(--fg-1);word-break:break-all}

/* Copyable bar */
.copy-bar{
  display:flex;align-items:center;gap:8px;
  background:var(--bg-2);border:1px solid var(--border);border-radius:6px;
  padding:8px 12px;margin-bottom:14px;
}
.copy-bar code{flex:1;font-size:12px;color:var(--fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy-btn{
  all:unset;cursor:pointer;color:var(--fg-3);display:flex;align-items:center;
  padding:3px 6px;border-radius:4px;font-size:11px;gap:4px;flex-shrink:0;
  transition:color .1s,background .1s;
}
.copy-btn:hover{color:var(--fg-1);background:var(--bg-3)}
.copy-btn.copied{color:var(--green)}

/* Utilities */
.mono{font-family:'SF Mono',ui-monospace,'Cascadia Mono',Menlo,monospace;font-size:12px}
.trunc{max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle}
.muted{color:var(--fg-2)}
.dim{color:var(--fg-3)}
.sm{font-size:12px}
.empty{text-align:center;padding:32px 16px;color:var(--fg-3);font-size:13px}
.flex-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.mt{margin-top:14px}
.mb{margin-bottom:14px}
`
