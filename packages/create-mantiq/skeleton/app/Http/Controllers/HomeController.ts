import type { MantiqRequest } from '@mantiq/core'
import { config } from '@mantiq/core'

export class HomeController {
  async index(_request: MantiqRequest): Promise<Response> {
    const appName = config('app.name') ?? 'MantiqJS'
    const appEnv = config('app.env') ?? 'production'
    const debug = config('app.debug') ? 'Enabled' : 'Disabled'
    const bunVersion = typeof Bun !== 'undefined' ? Bun.version : 'unknown'

    let mantiqVersion = '0.0.0'
    try {
      const pkg = await Bun.file(require.resolve('@mantiq/core/package.json')).json()
      mantiqVersion = pkg.version
    } catch { /* fallback */ }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      background:#0a0a0b;color:#fafafa;min-height:100vh;
      display:flex;align-items:center;justify-content:center;
      -webkit-font-smoothing:antialiased;
    }
    .c{width:100%;max-width:460px;padding:32px;animation:up .5s ease}
    @keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .w{font-size:28px;font-weight:600;letter-spacing:-0.04em;color:#fafafa}
    .w .d{color:#10b981}
    .v{font-family:'SF Mono',ui-monospace,monospace;font-size:12px;color:#52525b;margin-top:6px}
    hr{border:none;border-top:1px solid #1e1e1e;margin:24px 0}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .l{
      background:#111113;border:1px solid #1e1e1e;border-radius:8px;
      padding:14px 16px;text-decoration:none;color:#a1a1aa;font-size:13px;
      display:flex;align-items:center;justify-content:space-between;
      transition:border-color .15s,color .15s;
    }
    .l:hover{border-color:#27272a;color:#34d399}
    .l .a{color:#52525b;font-size:11px;transition:color .15s}
    .l:hover .a{color:#34d399}
    .e{
      margin-top:24px;font-family:'SF Mono',ui-monospace,monospace;
      font-size:11px;color:#3f3f46;line-height:2;
    }
    .e span{color:#52525b}
  </style>
</head>
<body>
  <div class="c">
    <div class="w"><span class="d">.</span>mantiq</div>
    <div class="v">v${mantiqVersion} — ${appName}</div>
    <hr>
    <div class="g">
      <a class="l" href="/_heartbeat">Heartbeat<span class="a">&rarr;</span></a>
      <a class="l" href="/api/ping">API Ping<span class="a">&rarr;</span></a>
      <a class="l" href="https://github.com/mantiqjs/mantiq" target="_blank" rel="noopener">GitHub<span class="a">&nearr;</span></a>
      <a class="l" href="https://www.npmjs.com/org/mantiq" target="_blank" rel="noopener">npm<span class="a">&nearr;</span></a>
    </div>
    <div class="e">
      <span>Runtime</span> Bun ${bunVersion}<br>
      <span>Environment</span> ${appEnv}<br>
      <span>Debug</span> ${debug}
    </div>
  </div>
</body>
</html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
