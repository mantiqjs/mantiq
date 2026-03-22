import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, rmSync, readdirSync, symlinkSync, lstatSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MONOREPO_ROOT = join(__dirname, '..')
const TMP_DIR = process.env.RUNNER_TEMP || '/tmp'

export interface TestApp {
  dir: string
  port: number
  url: string
  process: ChildProcess
  kill: () => void
}

/**
 * Scaffold a fresh mantiq app, link local packages, and boot the server.
 * Returns a handle with the URL and cleanup function.
 */
export async function createTestApp(
  name: string,
  kit?: 'react' | 'vue' | 'svelte',
): Promise<TestApp> {
  const dir = join(TMP_DIR, `e2e-${name}-${Date.now()}`)

  // Clean up any previous run
  if (existsSync(dir)) rmSync(dir, { recursive: true })

  // Scaffold
  const kitFlag = kit ? `--kit=${kit}` : ''
  execSync(
    `bun ${MONOREPO_ROOT}/packages/create-mantiq/src/index.ts ${dir} ${kitFlag} --yes --no-git`,
    { stdio: 'pipe', timeout: 120_000 },
  )

  // Link local workspace packages so we test current code
  const packagesDir = join(MONOREPO_ROOT, 'packages')
  const mantiqModules = join(dir, 'node_modules/@mantiq')
  for (const pkg of readdirSync(packagesDir)) {
    const pkgDir = join(packagesDir, pkg)
    const target = join(mantiqModules, pkg)
    // Force remove existing (directory or symlink) before linking
    try { lstatSync(target); rmSync(target, { recursive: true, force: true }) } catch {}
    try { symlinkSync(pkgDir, target) } catch {}
  }

  // Run migrations + seed if database config exists
  if (existsSync(join(dir, 'config/database.ts'))) {
    try {
      execSync('bun mantiq.ts migrate', { cwd: dir, stdio: 'pipe', timeout: 30_000 })
      execSync('bun mantiq.ts db:seed', { cwd: dir, stdio: 'pipe', timeout: 30_000 })
    } catch {
      // Seed may fail if command not registered — non-fatal
    }
  }

  // Find a free port
  const port = 3000 + Math.floor(Math.random() * 1000)

  // Boot the server
  const proc = spawn('bun', ['run', 'index.ts'], {
    cwd: dir,
    env: { ...process.env, APP_PORT: String(port), APP_DEBUG: 'true', APP_ENV: 'local' },
    stdio: 'pipe',
  })

  const url = `http://localhost:${port}`

  // Wait for server to be ready
  await waitForServer(url, 15_000)

  return {
    dir,
    port,
    url,
    process: proc,
    kill: () => {
      proc.kill('SIGTERM')
      // Clean up temp dir
      try { rmSync(dir, { recursive: true }) } catch {}
    },
  }
}

/**
 * POST with CSRF — GETs the base URL first to establish session + XSRF cookie,
 * then sends POST with X-XSRF-TOKEN header. Playwright persists cookies across calls.
 */
export async function postWithCsrf(
  request: any,
  url: string,
  data: Record<string, any>,
): Promise<any> {
  // Establish session + get XSRF-TOKEN cookie
  const baseUrl = new URL(url).origin + '/'
  const initRes = await request.get(baseUrl)
  const setCookies: string[] = (await initRes.headersArray()).filter((h: any) => h.name.toLowerCase() === 'set-cookie').map((h: any) => h.value)
  let xsrf = ''
  for (const c of setCookies) {
    const match = c.match(/XSRF-TOKEN=([^;]+)/)
    if (match) { xsrf = decodeURIComponent(match[1]); break }
  }

  return request.post(url, {
    data,
    headers: xsrf ? { 'X-XSRF-TOKEN': xsrf } : {},
  })
}

async function waitForServer(url: string, timeout: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`)
}
