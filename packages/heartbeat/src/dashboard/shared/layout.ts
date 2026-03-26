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
    { key: 'logs', label: 'Logs', icon: ICONS.file },
    { key: 'models', label: 'Models', icon: ICONS.cube },
    { key: 'schedules', label: 'Schedules', icon: ICONS.clock },
    { key: 'commands', label: 'Commands', icon: ICONS.terminal },
    { key: 'notifications', label: 'Notifications', icon: ICONS.bell },
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
      <span>heartbeat</span>
    </div>
    <nav>${nav}</nav>
    <div class="sidebar-footer">
      <span class="sidebar-brand-footer"><span style="color:var(--accent)">.</span>mantiq</span>
    </div>
  </aside>
  <main>
    <div class="topbar">
      <h1 class="page-title">${title}</h1>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="refresh-toggle" onclick="toggleAutoRefresh()" title="Toggle auto-refresh (R)">${ICONS.refresh} Auto</button>
        <button class="theme-btn" onclick="toggleTheme()" title="Toggle theme">${ICONS.moon}</button>
      </div>
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
    var _autoRefresh = false;
    var _refreshTimer = null;
    function toggleAutoRefresh() {
      _autoRefresh = !_autoRefresh;
      var btn = document.querySelector('.refresh-toggle');
      if (btn) btn.classList.toggle('active', _autoRefresh);
      if (_autoRefresh) {
        _refreshTimer = setInterval(function() { location.reload(); }, 5000);
      } else {
        clearInterval(_refreshTimer);
        _refreshTimer = null;
      }
    }
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'r') toggleAutoRefresh();
    });
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
  file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  cube: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  terminal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  bell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
}

// ── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
/* ── Animations ──────────────────────────────────────────────────────────── */
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse-glow{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes slide-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

/* ── Theme — High-contrast neon emerald ──────────────────────────────────── */
:root,[data-theme="light"]{
  --bg-0:#ffffff;--bg-1:#f8faf9;--bg-2:#f0f4f2;--bg-3:#e2e8e5;
  --fg-0:#0a0f0d;--fg-1:#1a2520;--fg-2:#5c6b64;--fg-3:#8a9691;
  --border:#d4ddd8;--border-2:#c0ccc6;
  --ring:rgba(16,185,129,.3);
  --accent:#059669;--accent-glow:rgba(5,150,105,.15);--accent-text:#047857;
  --green:#059669;--green-soft:rgba(5,150,105,.08);--green-glow:rgba(5,150,105,.2);
  --amber:#b45309;--amber-soft:rgba(180,83,9,.08);
  --red:#dc2626;--red-soft:rgba(220,38,38,.08);
  --blue:#2563eb;--blue-soft:rgba(37,99,235,.08);
  --card-bg:#ffffff;--card-border:#dce5e0;
  --surface-raised:#ffffff;
  --mono:'SF Mono',ui-monospace,'Cascadia Mono','JetBrains Mono',Menlo,monospace;
  --radius:12px;
}
[data-theme="dark"]{
  --bg-0:#050706;--bg-1:#0b0f0d;--bg-2:#111916;--bg-3:#1a2520;
  --fg-0:#f0fdf4;--fg-1:#d1fae5;--fg-2:#6ee7b7;--fg-3:#3b5249;
  --border:#1a2e25;--border-2:#234338;
  --ring:rgba(52,211,153,.4);
  --accent:#34d399;--accent-glow:rgba(52,211,153,.12);--accent-text:#6ee7b7;
  --green:#34d399;--green-soft:rgba(52,211,153,.1);--green-glow:rgba(52,211,153,.25);
  --amber:#fbbf24;--amber-soft:rgba(251,191,36,.1);
  --red:#fb7185;--red-soft:rgba(251,113,133,.1);
  --blue:#7dd3fc;--blue-soft:rgba(125,211,252,.1);
  --card-bg:#0b0f0d;--card-border:#1a2e25;
  --surface-raised:#0e1412;
  --mono:'SF Mono',ui-monospace,'Cascadia Mono','JetBrains Mono',Menlo,monospace;
  --radius:12px;
}

/* ── Reset ───────────────────────────────────────────────────────────────── */
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:var(--mono);
  font-size:13px;line-height:1.6;color:var(--fg-0);background:var(--bg-0);
  display:flex;min-height:100vh;-webkit-font-smoothing:antialiased;
  font-feature-settings:'liga' 1,'calt' 1;
}
::selection{background:var(--accent-glow);color:var(--fg-0)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:10px}
::-webkit-scrollbar-thumb:hover{background:var(--fg-3)}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.sidebar{
  width:220px;background:var(--bg-1);border-right:1px solid var(--border);
  display:flex;flex-direction:column;position:fixed;top:0;bottom:0;z-index:10;
}
.brand{
  padding:20px 18px;font-size:13px;font-weight:700;color:var(--accent);
  display:flex;align-items:center;gap:10px;letter-spacing:-.02em;
  font-family:var(--mono);
}
.brand svg{color:var(--accent);filter:drop-shadow(0 0 6px var(--green-glow))}
.sidebar nav{padding:8px 10px;flex:1;overflow-y:auto}
.sidebar nav a{
  display:flex;align-items:center;gap:10px;
  padding:8px 12px;border-radius:var(--radius);margin:2px 0;
  color:var(--fg-3);text-decoration:none;font-size:12px;font-weight:500;
  transition:all .2s cubic-bezier(.4,0,.2,1);
  border:1px solid transparent;
  font-family:var(--mono);
}
.sidebar nav a span{flex:1}
.sidebar nav a svg{flex-shrink:0;opacity:.5;transition:all .2s}
.sidebar nav a:hover{
  color:var(--fg-1);background:var(--accent-glow);
  border-color:var(--border);
}
.sidebar nav a:hover svg{opacity:.9;color:var(--accent)}
.sidebar nav a.active{
  color:var(--accent-text);background:var(--accent-glow);
  border-color:var(--accent);font-weight:600;
}
.sidebar nav a.active svg{opacity:1;color:var(--accent);filter:drop-shadow(0 0 4px var(--green-glow))}
.sidebar-footer{
  border-top:1px solid var(--border);padding:14px 18px;
  display:flex;align-items:center;justify-content:space-between;
}
.sidebar-brand-footer{
  font-size:11px;font-weight:600;color:var(--fg-3);opacity:.5;
  font-family:var(--mono);letter-spacing:.02em;
}
.theme-btn{
  all:unset;color:var(--fg-3);cursor:pointer;display:flex;align-items:center;
  padding:6px;border-radius:8px;border:1px solid var(--border);
  transition:all .2s;
}
.theme-btn:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-glow)}

/* ── Main ────────────────────────────────────────────────────────────────── */
main{
  margin-left:220px;flex:1;padding:28px 32px;max-width:1200px;position:relative;
  animation:fadeIn .3s ease-out;
}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.page-title{
  font-size:20px;font-weight:700;letter-spacing:-.03em;color:var(--fg-0);margin:0;
  font-family:var(--mono);
}

/* ── Cards — Raised Apple-like ───────────────────────────────────────────── */
.card{
  background:var(--card-bg);border:1px solid var(--card-border);
  border-radius:var(--radius);padding:18px 20px;margin-bottom:16px;
  transition:border-color .2s;
}
.card:hover{border-color:var(--border-2)}
.card-title{
  font-size:10px;font-weight:700;color:var(--fg-3);
  text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;
  font-family:var(--mono);
}

/* ── Stats — Neon glow on hover ──────────────────────────────────────────── */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:20px}
.stat{
  background:var(--card-bg);border:1px solid var(--card-border);
  border-radius:var(--radius);padding:16px 18px;
  transition:all .25s cubic-bezier(.4,0,.2,1);
  animation:slide-up .4s ease-out both;
}
.stat:hover{border-color:var(--accent);background:var(--accent-glow)}
.stat-label{
  font-size:10px;font-weight:700;color:var(--fg-3);
  text-transform:uppercase;letter-spacing:.1em;
  font-family:var(--mono);
}
.stat-val{
  font-size:28px;font-weight:800;letter-spacing:-.04em;margin-top:6px;
  color:var(--fg-0);font-variant-numeric:tabular-nums;
  font-family:var(--mono);
}
.stat-sub{font-size:10px;color:var(--fg-3);margin-top:3px;font-family:var(--mono)}

/* ── Tables — Clean monospace ────────────────────────────────────────────── */
table{width:100%;border-collapse:collapse;font-size:12px;font-family:var(--mono)}
thead th{
  text-align:left;padding:8px 12px;font-size:10px;font-weight:700;
  color:var(--fg-3);text-transform:uppercase;letter-spacing:.08em;
  border-bottom:1px solid var(--border);
}
tbody td{
  padding:10px 12px;border-bottom:1px solid var(--border);
  color:var(--fg-1);vertical-align:middle;
  transition:background .15s;
}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--accent-glow)}
tbody tr{animation:fadeIn .3s ease-out both}
tbody tr:nth-child(1){animation-delay:.02s}
tbody tr:nth-child(2){animation-delay:.04s}
tbody tr:nth-child(3){animation-delay:.06s}
tbody tr:nth-child(4){animation-delay:.08s}
tbody tr:nth-child(5){animation-delay:.1s}

/* ── Badges — Pill-shaped with glow ──────────────────────────────────────── */
.b{
  display:inline-flex;align-items:center;padding:2px 10px;border-radius:100px;
  font-size:11px;font-weight:600;line-height:18px;white-space:nowrap;
  font-family:var(--mono);letter-spacing:.01em;
  transition:all .2s;
}
.b-green{background:var(--green-soft);color:var(--green);border:1px solid var(--green-glow)}
.b-amber{background:var(--amber-soft);color:var(--amber);border:1px solid rgba(251,191,36,.2)}
.b-red{background:var(--red-soft);color:var(--red);border:1px solid rgba(251,113,133,.2)}
.b-blue{background:var(--blue-soft);color:var(--blue);border:1px solid rgba(125,211,252,.2)}
.b-mute{background:var(--bg-3);color:var(--fg-2);border:1px solid var(--border)}

/* ── Tabs ────────────────────────────────────────────────────────────────── */
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:0}
.tabs input[type="radio"]{display:none}
.tabs label{
  padding:10px 18px;font-size:12px;font-weight:600;color:var(--fg-3);
  cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;
  transition:all .2s;font-family:var(--mono);
}
.tabs label:hover{color:var(--fg-1)}
.tabs input[type="radio"]:checked+label{
  color:var(--accent-text);border-bottom-color:var(--accent);
}
.tab-panel{display:none;padding:16px 0 0;animation:fadeIn .2s ease-out}
.tab-panel.active{display:block}

/* ── Detail meta ─────────────────────────────────────────────────────────── */
.meta-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0}
.meta-item{padding:12px 16px;border-bottom:1px solid var(--border)}
.meta-item:last-child{border-bottom:none}
.meta-label{
  font-size:10px;font-weight:700;color:var(--fg-3);
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;
  font-family:var(--mono);
}
.meta-value{font-size:12px;color:var(--fg-1);word-break:break-all;font-family:var(--mono)}

/* ── Copy ────────────────────────────────────────────────────────────────── */
.copy-bar{
  display:flex;align-items:center;gap:8px;
  background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);
  padding:10px 14px;margin-bottom:16px;
}
.copy-bar code{flex:1;font-size:11px;color:var(--fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy-btn{
  all:unset;cursor:pointer;color:var(--fg-3);display:flex;align-items:center;
  padding:4px 8px;border-radius:8px;font-size:11px;gap:4px;flex-shrink:0;
  transition:all .2s;border:1px solid transparent;font-family:var(--mono);
}
.copy-btn:hover{color:var(--accent);background:var(--accent-glow);border-color:var(--accent)}
.copy-btn.copied{color:var(--green);border-color:var(--green)}

/* ── Utilities ───────────────────────────────────────────────────────────── */
.mono{font-family:var(--mono);font-size:11px}
.trunc{max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle}
.muted{color:var(--fg-2)}
.dim{color:var(--fg-3)}
.sm{font-size:11px}
.empty{text-align:center;padding:40px 16px;color:var(--fg-3);font-size:12px}
.flex-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.mt{margin-top:16px}
.mb{margin-bottom:16px}

/* ── Pagination — Pill buttons ───────────────────────────────────────────── */
.pagination{display:flex;gap:4px;align-items:center;margin-top:20px;justify-content:center}
.pagination a,.pagination span{
  padding:5px 12px;border-radius:100px;font-size:11px;font-weight:600;
  text-decoration:none;color:var(--fg-3);border:1px solid var(--border);
  transition:all .2s;font-family:var(--mono);
}
.pagination a:hover{background:var(--accent-glow);color:var(--accent);border-color:var(--accent)}
.pagination .active{background:var(--accent);color:var(--bg-0);border-color:var(--accent)}
.pagination .disabled{opacity:.3;pointer-events:none}

/* ── Filter bar ──────────────────────────────────────────────────────────── */
.filter-bar{display:flex;gap:8px;align-items:center;margin-bottom:18px;flex-wrap:wrap}
.filter-bar input,.filter-bar select{
  background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);
  padding:8px 12px;font-size:11px;color:var(--fg-1);outline:none;
  font-family:var(--mono);transition:all .2s;
}
.filter-bar input:focus,.filter-bar select:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.filter-bar input{min-width:200px}
.filter-bar select{min-width:100px}

/* ── Breadcrumbs ─────────────────────────────────────────────────────────── */
.breadcrumbs{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--fg-3);margin-bottom:14px;font-family:var(--mono)}
.breadcrumbs a{color:var(--fg-2);text-decoration:none;transition:color .15s}
.breadcrumbs a:hover{color:var(--accent)}
.breadcrumbs .sep{color:var(--fg-3);opacity:.5}

/* ── Collapsible ─────────────────────────────────────────────────────────── */
.collapsible{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:8px;transition:border-color .2s}
.collapsible:hover{border-color:var(--border-2)}
.collapsible-header{
  display:flex;align-items:center;gap:8px;padding:12px 16px;
  cursor:pointer;background:var(--bg-1);user-select:none;
  transition:background .15s;
}
.collapsible-header:hover{background:var(--accent-glow)}
.collapsible-header .chevron{transition:transform .2s cubic-bezier(.4,0,.2,1);font-size:10px;color:var(--fg-3)}
.collapsible-header.open .chevron{transform:rotate(90deg)}
.collapsible-body{padding:0 16px 12px;display:none;animation:fadeIn .2s ease-out}
.collapsible-body.open{display:block}

/* ── Waterfall ───────────────────────────────────────────────────────────── */
.waterfall{display:flex;flex-direction:column;gap:4px}
.waterfall-row{display:flex;align-items:center;gap:8px;font-size:10px;font-family:var(--mono);animation:fadeIn .3s ease-out both}
.waterfall-label{width:110px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg-2);flex-shrink:0}
.waterfall-track{flex:1;height:18px;background:var(--bg-2);border-radius:100px;position:relative;overflow:hidden}
.waterfall-bar{position:absolute;height:100%;border-radius:100px;min-width:3px;opacity:.8;transition:opacity .2s}
.waterfall-row:hover .waterfall-bar{opacity:1}
.waterfall-dur{width:60px;text-align:right;color:var(--fg-3);flex-shrink:0}

/* ── SQL ─────────────────────────────────────────────────────────────────── */
.sql-kw{color:#a78bfa;font-weight:700}
.sql-str{color:var(--accent)}
.sql-num{color:#fbbf24}
.sql-fn{color:#7dd3fc}

/* ── Auto-refresh ────────────────────────────────────────────────────────── */
.refresh-toggle{
  background:none;border:1px solid var(--border);border-radius:100px;
  padding:5px 12px;cursor:pointer;color:var(--fg-3);font-size:11px;
  display:flex;align-items:center;gap:5px;font-family:var(--mono);font-weight:600;
  transition:all .2s;
}
.refresh-toggle:hover{border-color:var(--fg-3);color:var(--fg-2)}
.refresh-toggle.active{
  border-color:var(--accent);color:var(--accent);background:var(--accent-glow);
  animation:pulse-glow 2s ease-in-out infinite;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state{text-align:center;padding:56px 24px;color:var(--fg-3)}
.empty-state .icon{font-size:36px;margin-bottom:14px;opacity:.4}
.empty-state .title{font-size:13px;font-weight:700;color:var(--fg-2);margin-bottom:4px;font-family:var(--mono)}
.empty-state .desc{font-size:11px;font-family:var(--mono)}

/* ── Links ───────────────────────────────────────────────────────────────── */
a{color:var(--accent);transition:color .15s}
a:hover{color:var(--accent-text)}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media(max-width:768px){
  .sidebar{display:none}
  main{margin-left:0;padding:16px}
}
`
