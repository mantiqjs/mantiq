import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, config } from '@mantiq/core'

export class HomeController {
  /** GET / */
  index(_request: MantiqRequest): Response {
    return MantiqResponse.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${config('app.name')}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f0f0f; color: #e2e8f0; }
    .card { text-align: center; padding: 3rem; }
    h1 { font-size: 3rem; margin: 0; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { color: #718096; margin-top: 1rem; font-size: 1.1rem; }
    .links { margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    a { color: #90cdf4; text-decoration: none; padding: 0.5rem 1rem; border: 1px solid #2d3748; border-radius: 6px; }
    a:hover { border-color: #90cdf4; }
    .env { display: inline-block; background: #2d3748; color: #68d391; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-family: monospace; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>MantiqJS</h1>
    <p>The logical framework for Bun</p>
    <div class="env">${config('app.env')} · Bun ${Bun.version}</div>
    <div class="links">
      <a href="/api/ping">GET /api/ping</a>
      <a href="/api/users">GET /api/users</a>
      <a href="/api/users/1">GET /api/users/1</a>
      <a href="/api/users/999">GET /api/users/999 (404)</a>
      <a href="/broken">GET /broken (500)</a>
      <a href="/api/echo" onclick="testEcho(event)">POST /api/echo</a>
    </div>
    <script>
      async function testEcho(e) {
        e.preventDefault()
        const res = await fetch('/api/echo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ message: 'Hello from the browser!' })
        })
        alert(JSON.stringify(await res.json(), null, 2))
      }
    </script>
  </div>
</body>
</html>`)
  }
}
