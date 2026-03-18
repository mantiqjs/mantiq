import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Renders a self-contained HTML error page for development (APP_DEBUG=true).
 * No external dependencies — all CSS is inline.
 */
export function renderDevErrorPage(request: MantiqRequest, error: unknown): string {
  const err = error instanceof Error ? error : new Error(String(error))
  const stack = err.stack ?? err.message
  const bunVersion = typeof Bun !== 'undefined' ? Bun.version : 'unknown'

  const stackLines = stack
    .split('\n')
    .map((line) => `<div class="stack-line">${escapeHtml(line)}</div>`)
    .join('')

  const headers = Object.entries(request.headers())
    .map(([k, v]) => `<tr><td class="key">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(err.name)}: ${escapeHtml(err.message)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'SF Mono', 'Fira Code', monospace; background: #0f0f0f; color: #e2e8f0; min-height: 100vh; }
    .header { background: #1a1a2e; border-bottom: 2px solid #e53e3e; padding: 1.5rem 2rem; }
    .error-name { color: #e53e3e; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
    .error-message { color: #f7fafc; font-size: 1.4rem; font-weight: 700; margin-top: 0.5rem; font-family: system-ui, sans-serif; }
    .meta { color: #718096; font-size: 0.8rem; margin-top: 0.5rem; }
    .body { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .panel { padding: 1.5rem 2rem; border-bottom: 1px solid #2d3748; }
    .panel-full { grid-column: 1 / -1; }
    h2 { color: #90cdf4; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem; font-family: system-ui, sans-serif; }
    .stack { background: #1a202c; border-radius: 6px; padding: 1rem; overflow-x: auto; }
    .stack-line { color: #e2e8f0; font-size: 0.8rem; line-height: 1.6; white-space: pre; }
    .stack-line:first-child { color: #fc8181; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #2d3748; vertical-align: top; word-break: break-all; }
    td.key { color: #90cdf4; width: 35%; font-weight: 600; white-space: nowrap; }
    .badge { display: inline-block; background: #2d3748; color: #90cdf4; border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.7rem; margin-right: 0.5rem; }
    .method-${request.method().toLowerCase()} { background: #2c5282; color: #bee3f8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="error-name">${escapeHtml(err.name)}</div>
    <div class="error-message">${escapeHtml(err.message)}</div>
    <div class="meta">
      <span class="badge method-${request.method().toLowerCase()}">${escapeHtml(request.method())}</span>
      <span class="badge">${escapeHtml(request.fullUrl())}</span>
      <span class="badge">Bun ${bunVersion}</span>
      <span class="badge">MantiqJS</span>
    </div>
  </div>
  <div class="body">
    <div class="panel panel-full">
      <h2>Stack Trace</h2>
      <div class="stack">${stackLines}</div>
    </div>
    <div class="panel">
      <h2>Request Headers</h2>
      <table><tbody>${headers}</tbody></table>
    </div>
    <div class="panel">
      <h2>Request Info</h2>
      <table>
        <tr><td class="key">Method</td><td>${escapeHtml(request.method())}</td></tr>
        <tr><td class="key">Path</td><td>${escapeHtml(request.path())}</td></tr>
        <tr><td class="key">Full URL</td><td>${escapeHtml(request.fullUrl())}</td></tr>
        <tr><td class="key">IP</td><td>${escapeHtml(request.ip())}</td></tr>
        <tr><td class="key">User Agent</td><td>${escapeHtml(request.userAgent())}</td></tr>
        <tr><td class="key">Expects JSON</td><td>${request.expectsJson() ? 'Yes' : 'No'}</td></tr>
        <tr><td class="key">Authenticated</td><td>${request.isAuthenticated() ? 'Yes' : 'No'}</td></tr>
      </table>
    </div>
  </div>
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
