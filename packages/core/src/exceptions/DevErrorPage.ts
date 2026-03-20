import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Renders a self-contained HTML error page for development (APP_DEBUG=true).
 * No external dependencies — all CSS and JS are inline.
 *
 * Features:
 * - Light/dark mode (respects system preference, toggleable)
 * - Tabbed interface: Stack Trace / Request / App
 * - Copy as Markdown button
 * - Source file context when available
 */
export function renderDevErrorPage(request: MantiqRequest, error: unknown): string {
  const err = error instanceof Error ? error : new Error(String(error))
  const stack = err.stack ?? err.message
  const bunVersion = typeof Bun !== 'undefined' ? Bun.version : 'unknown'
  const statusCode = 'statusCode' in err ? (err as any).statusCode : 500

  // Parse stack into structured frames
  const rawLines = stack.split('\n')
  const frames = rawLines
    .slice(1)
    .map((line) => {
      const trimmed = line.trim()
      // Match "at functionName (file:line:col)" or "at file:line:col"
      const match = trimmed.match(/^at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?$/)
      if (match) {
        return {
          fn: match[1] ?? '<anonymous>',
          file: match[2]!,
          line: parseInt(match[3]!, 10),
          col: parseInt(match[4]!, 10),
          raw: trimmed,
        }
      }
      return { fn: '', file: '', line: 0, col: 0, raw: trimmed }
    })
    .filter((f) => f.raw.length > 0)

  const framesHtml = frames
    .map((f, i) => {
      if (!f.file) {
        return `<div class="frame${i === 0 ? ' frame-active' : ''}">${escapeHtml(f.raw)}</div>`
      }
      const shortFile = f.file.replace(/^.*node_modules\//, 'node_modules/').replace(/^.*\/packages\//, 'packages/')
      const isVendor = f.file.includes('node_modules')
      return `<div class="frame${i === 0 ? ' frame-active' : ''}${isVendor ? ' frame-vendor' : ''}" data-file="${escapeHtml(f.file)}" data-line="${f.line}">
        <span class="frame-fn">${escapeHtml(f.fn)}</span>
        <span class="frame-loc">${escapeHtml(shortFile)}:${f.line}</span>
      </div>`
    })
    .join('')

  const headersHtml = Object.entries(request.headers())
    .map(([k, v]) => `<tr><td class="td-key">${escapeHtml(k)}</td><td class="td-val">${escapeHtml(v)}</td></tr>`)
    .join('')

  const queryString = request.fullUrl().includes('?') ? request.fullUrl().split('?')[1] : ''
  const queryParams = queryString
    ? queryString.split('&').map((pair) => {
      const [k, ...rest] = pair.split('=')
      return `<tr><td class="td-key">${escapeHtml(decodeURIComponent(k!))}</td><td class="td-val">${escapeHtml(decodeURIComponent(rest.join('=')))}</td></tr>`
    }).join('')
    : '<tr><td class="td-val" colspan="2" style="opacity:.5">No query parameters</td></tr>'

  // Markdown for clipboard
  const markdown = [
    `# ${err.name}: ${err.message}`,
    '',
    `**Status:** ${statusCode}`,
    `**Method:** ${request.method()}`,
    `**URL:** ${request.fullUrl()}`,
    `**IP:** ${request.ip()}`,
    `**User Agent:** ${request.userAgent()}`,
    '',
    '## Stack Trace',
    '```',
    stack,
    '```',
    '',
    '## Request Headers',
    '| Header | Value |',
    '|--------|-------|',
    ...Object.entries(request.headers()).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    `*Bun ${bunVersion} — MantiqJS*`,
  ].join('\n')

  const methodColors: Record<string, string> = {
    GET: '#10b981',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    PATCH: '#f59e0b',
    DELETE: '#ef4444',
    OPTIONS: '#8b5cf6',
  }
  const methodColor = methodColors[request.method()] ?? '#6b7280'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(err.name)}: ${escapeHtml(err.message)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #ffffff;
      --bg-surface: #f9fafb;
      --bg-elevated: #f3f4f6;
      --bg-code: #f9fafb;
      --text: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --border: #e5e7eb;
      --accent: #10b981;
      --accent-soft: rgba(16,185,129,0.08);
      --accent-text: #059669;
      --error: #ef4444;
      --error-soft: #fef2f2;
      --error-text: #dc2626;
      --link: #059669;
      --badge-bg: #f3f4f6;
      --badge-text: #475569;
      --frame-hover: #f3f4f6;
      --frame-active-bg: rgba(16,185,129,0.06);
      --frame-active-border: #6ee7b7;
      --tab-active-bg: #ffffff;
      --tab-active-border: #10b981;
      --vendor-opacity: 0.45;
      --shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
      --shadow-lg: 0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05);
      --radius: 8px;
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    }

    html.dark {
      --bg: #0a0a0b;
      --bg-surface: #111113;
      --bg-elevated: #1a1a1d;
      --bg-code: #111113;
      --text: #e2e8f0;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border: #27272a;
      --accent: #34d399;
      --accent-soft: rgba(16,185,129,0.10);
      --accent-text: #34d399;
      --error: #f87171;
      --error-soft: rgba(248,113,113,0.08);
      --error-text: #f87171;
      --link: #34d399;
      --badge-bg: #1a1a1d;
      --badge-text: #94a3b8;
      --frame-hover: #1a1a1d;
      --frame-active-bg: rgba(16,185,129,0.06);
      --frame-active-border: #10b981;
      --tab-active-bg: #111113;
      --tab-active-border: #10b981;
      --shadow: 0 1px 3px rgba(0,0,0,.3);
      --shadow-lg: 0 4px 6px -1px rgba(0,0,0,.4);
    }

    body {
      font-family: var(--font-sans);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Header ─────────────────────── */
    .header {
      padding: 24px 32px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
    }
    .header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .error-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--error-text);
      letter-spacing: 0.02em;
    }
    .error-label .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--error);
      display: inline-block;
    }
    .error-message {
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      margin-top: 8px;
      line-height: 1.35;
      word-break: break-word;
    }
    .header-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      padding-top: 2px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 500;
      font-family: var(--font-sans);
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .btn:hover { background: var(--bg-elevated); color: var(--text); }
    .btn svg { width: 15px; height: 15px; }
    .btn-copied { border-color: #10b981; color: #10b981; }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
      align-items: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: 500;
      font-family: var(--font-mono);
      border-radius: 4px;
      background: var(--badge-bg);
      color: var(--badge-text);
      border: 1px solid var(--border);
    }
    .badge-method {
      color: #fff;
      border-color: transparent;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .badge-status {
      color: var(--error-text);
      background: var(--error-soft);
      border-color: var(--error);
    }

    /* ── Tabs ──────────────────────── */
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
      padding: 0 32px;
      gap: 0;
    }
    .tab {
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s ease;
      user-select: none;
      background: none;
      border-top: none;
      border-left: none;
      border-right: none;
      font-family: var(--font-sans);
    }
    .tab:hover { color: var(--text-secondary); }
    .tab.active {
      color: var(--accent-text);
      border-bottom-color: var(--tab-active-border);
      font-weight: 600;
    }

    /* ── Content ───────────────────── */
    .content { padding: 0; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* ── Stack Trace ───────────────── */
    .stack-panel { padding: 0; }
    .frames {
      border-right: 1px solid var(--border);
      overflow-y: auto;
      max-height: calc(100vh - 200px);
    }
    .frame {
      padding: 10px 24px 10px 32px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.1s ease;
      border-left: 3px solid transparent;
      font-size: 13px;
    }
    .frame:hover { background: var(--frame-hover); }
    .frame-active {
      background: var(--frame-active-bg);
      border-left-color: var(--frame-active-border);
    }
    .frame-vendor { opacity: var(--vendor-opacity); }
    .frame-vendor:hover { opacity: 0.8; }
    .frame-fn {
      display: block;
      font-weight: 600;
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--text);
      line-height: 1.4;
    }
    .frame-loc {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      margin-top: 2px;
    }

    /* ── Request / App panels ──────── */
    .info-panel { padding: 24px 32px; }
    .info-section { margin-bottom: 28px; }
    .info-section:last-child { margin-bottom: 0; }
    .info-section h3 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    table { width: 100%; border-collapse: collapse; }
    table tr { border-bottom: 1px solid var(--border); }
    table tr:last-child { border-bottom: none; }
    .td-key {
      padding: 8px 16px 8px 0;
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-secondary);
      width: 220px;
      white-space: nowrap;
      vertical-align: top;
    }
    .td-val {
      padding: 8px 0;
      font-family: var(--font-mono);
      font-size: 12.5px;
      color: var(--text);
      word-break: break-all;
    }

    /* ── Toast ─────────────────────── */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--text);
      color: var(--bg);
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: var(--shadow-lg);
      opacity: 0;
      transform: translateY(8px);
      transition: all 0.2s ease;
      pointer-events: none;
      z-index: 100;
    }
    .toast.show { opacity: 1; transform: translateY(0); }

    /* ── Responsive ────────────────── */
    @media (max-width: 768px) {
      .header { padding: 16px 20px; }
      .header-top { flex-direction: column; }
      .error-message { font-size: 18px; }
      .tabs { padding: 0 20px; }
      .frame { padding: 10px 20px; }
      .info-panel { padding: 20px; }
      .td-key { width: 140px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="error-label">
          <span class="dot"></span>
          ${escapeHtml(err.name)}
        </div>
        <div class="error-message">${escapeHtml(err.message)}</div>
      </div>
      <div class="header-actions">
        <button class="btn" id="btn-copy" onclick="copyMarkdown()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy as Markdown
        </button>
        <button class="btn" id="btn-theme" onclick="toggleTheme()">
          <svg id="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg id="icon-moon" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        </button>
      </div>
    </div>
    <div class="meta-bar">
      <span class="badge badge-method" style="background:${methodColor}">${escapeHtml(request.method())}</span>
      <span class="badge">${escapeHtml(request.fullUrl())}</span>
      <span class="badge badge-status">${statusCode}</span>
      <span class="badge">Bun ${escapeHtml(bunVersion)}</span>
      <span class="badge" style="color:var(--accent);border-color:var(--accent)">mantiq</span>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="stack">Stack Trace</button>
    <button class="tab" data-tab="request">Request</button>
    <button class="tab" data-tab="app">App</button>
  </div>

  <div class="content">
    <!-- Stack Trace Tab -->
    <div class="tab-panel active" id="panel-stack">
      <div class="frames">
        ${framesHtml}
      </div>
    </div>

    <!-- Request Tab -->
    <div class="tab-panel" id="panel-request">
      <div class="info-panel">
        <div class="info-section">
          <h3>Request Information</h3>
          <table>
            <tr><td class="td-key">Method</td><td class="td-val">${escapeHtml(request.method())}</td></tr>
            <tr><td class="td-key">Path</td><td class="td-val">${escapeHtml(request.path())}</td></tr>
            <tr><td class="td-key">Full URL</td><td class="td-val">${escapeHtml(request.fullUrl())}</td></tr>
            <tr><td class="td-key">IP Address</td><td class="td-val">${escapeHtml(request.ip())}</td></tr>
            <tr><td class="td-key">User Agent</td><td class="td-val">${escapeHtml(request.userAgent())}</td></tr>
            <tr><td class="td-key">Expects JSON</td><td class="td-val">${request.expectsJson() ? 'Yes' : 'No'}</td></tr>
            <tr><td class="td-key">Authenticated</td><td class="td-val">${request.isAuthenticated() ? 'Yes' : 'No'}</td></tr>
          </table>
        </div>

        <div class="info-section">
          <h3>Query Parameters</h3>
          <table>${queryParams}</table>
        </div>

        <div class="info-section">
          <h3>Headers</h3>
          <table>${headersHtml}</table>
        </div>
      </div>
    </div>

    <!-- App Tab -->
    <div class="tab-panel" id="panel-app">
      <div class="info-panel">
        <div class="info-section">
          <h3>Environment</h3>
          <table>
            <tr><td class="td-key">Runtime</td><td class="td-val">Bun ${escapeHtml(bunVersion)}</td></tr>
            <tr><td class="td-key">Framework</td><td class="td-val">MantiqJS</td></tr>
            <tr><td class="td-key">Environment</td><td class="td-val">${escapeHtml(process.env['NODE_ENV'] ?? process.env['APP_ENV'] ?? 'development')}</td></tr>
            <tr><td class="td-key">Debug Mode</td><td class="td-val">Enabled</td></tr>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast">Copied to clipboard</div>

  <script>
    // ── Theme ───────────────────────────────
    (function() {
      var pref = localStorage.getItem('mantiq-theme');
      if (pref === 'dark' || (!pref && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
      updateThemeIcon();
    })();

    function toggleTheme() {
      var html = document.documentElement;
      var isDark = html.classList.toggle('dark');
      localStorage.setItem('mantiq-theme', isDark ? 'dark' : 'light');
      updateThemeIcon();
    }

    function updateThemeIcon() {
      var isDark = document.documentElement.classList.contains('dark');
      document.getElementById('icon-sun').style.display = isDark ? 'none' : 'block';
      document.getElementById('icon-moon').style.display = isDark ? 'block' : 'none';
    }

    // ── Tabs ────────────────────────────────
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
      });
    });

    // ── Copy as Markdown ────────────────────
    var markdownContent = ${JSON.stringify(markdown)};

    function copyMarkdown() {
      navigator.clipboard.writeText(markdownContent).then(function() {
        var btn = document.getElementById('btn-copy');
        btn.classList.add('btn-copied');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
        showToast('Copied to clipboard');
        setTimeout(function() {
          btn.classList.remove('btn-copied');
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy as Markdown';
        }, 2000);
      });
    }

    // ── Toast ────────────────────────────────
    function showToast(msg) {
      var toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(function() { toast.classList.remove('show'); }, 2000);
    }

    // ── Frame clicks ────────────────────────
    document.querySelectorAll('.frame').forEach(function(frame) {
      frame.addEventListener('click', function() {
        document.querySelectorAll('.frame').forEach(function(f) { f.classList.remove('frame-active'); });
        frame.classList.add('frame-active');
      });
    });
  </script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
