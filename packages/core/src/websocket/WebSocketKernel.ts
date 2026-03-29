import type { WebSocketHandler } from './WebSocketContext.ts'
import type { AesEncrypter } from '../encryption/Encrypter.ts'
import { MantiqRequest } from '../http/Request.ts'
import { parseCookies } from '../http/Cookie.ts'

/**
 * Handles WebSocket upgrade detection and lifecycle delegation.
 *
 * Core only provides the infrastructure — @mantiq/realtime registers
 * its handler via registerHandler(). Without it, all upgrades return 426.
 *
 * IMPORTANT: WebSocket upgrade requests bypass the HTTP middleware pipeline
 * entirely. This means middleware like VerifyCsrfToken, StartSession, and
 * CorsMiddleware do NOT run on WebSocket connections. Authentication must
 * be handled in the onUpgrade hook (via the registered WebSocketHandler's
 * `onUpgrade` method). Cookie decryption is handled manually below.
 *
 * If you need additional request validation on upgrade, register an
 * `onUpgrade` callback in your WebSocketHandler implementation that
 * performs the necessary checks (e.g., origin verification, rate limiting).
 */
export class WebSocketKernel {
  private handler: WebSocketHandler | null = null
  private encrypter: AesEncrypter | null = null

  /**
   * Optional hooks that run during the upgrade request before the handler's
   * onUpgrade. Use this to add origin checks, rate limiting, or other
   * validation that would normally be done by HTTP middleware.
   *
   * Return a Response to reject the upgrade, or void/undefined to continue.
   */
  private upgradeHooks: Array<(request: MantiqRequest) => Promise<Response | void>> = []

  /**
   * Called by @mantiq/realtime to register its WebSocket handler.
   */
  registerHandler(handler: WebSocketHandler): void {
    this.handler = handler
  }

  /**
   * Register a hook that runs on every WebSocket upgrade request.
   * Since WebSocket upgrades bypass the HTTP middleware pipeline,
   * use this to add checks that middleware would normally handle
   * (e.g., origin validation, rate limiting, auth).
   *
   * Return a Response to reject the upgrade, or void to continue.
   */
  onUpgrade(hook: (request: MantiqRequest) => Promise<Response | void>): void {
    this.upgradeHooks.push(hook)
  }

  /**
   * Inject the encrypter so WebSocket upgrades can decrypt cookies.
   * Called during CoreServiceProvider boot.
   */
  setEncrypter(encrypter: AesEncrypter): void {
    this.encrypter = encrypter
  }

  /**
   * Called by HttpKernel when an upgrade request is detected.
   *
   * NOTE: The HTTP middleware pipeline does NOT run for WebSocket upgrades.
   * Authentication is delegated to the handler's onUpgrade method.
   */
  async handleUpgrade(request: Request, server: any): Promise<Response> {
    if (!this.handler) {
      return new Response('WebSocket not available. Install @mantiq/realtime.', {
        status: 426,
        headers: { Upgrade: 'websocket' },
      })
    }

    const mantiqRequest = MantiqRequest.fromBun(request)

    // Decrypt cookies — WebSocket upgrades bypass the middleware pipeline,
    // so EncryptCookies never runs. Manually decrypt here.
    if (this.encrypter) {
      await this.decryptCookies(mantiqRequest)
    }

    // Run onUpgrade hooks — these substitute for HTTP middleware that
    // would normally run (auth, origin checks, rate limiting, etc.).
    for (const hook of this.upgradeHooks) {
      const rejection = await hook(mantiqRequest)
      if (rejection instanceof Response) {
        return rejection
      }
    }

    const context = await this.handler.onUpgrade(mantiqRequest)

    if (!context) {
      return new Response('Unauthorized', { status: 401 })
    }

    const upgraded = server.upgrade(request, { data: context })
    if (!upgraded) {
      return new Response('WebSocket upgrade failed', { status: 500 })
    }

    // Bun handles the response after a successful upgrade
    return undefined as unknown as Response
  }

  /**
   * Returns the Bun WebSocket handlers object for Bun.serve().
   * If no handler is registered, provides no-op stubs.
   *
   * Includes maxPayloadLength from the handler if available, which tells
   * Bun to enforce a transport-level message size limit.
   */
  getBunHandlers(): object {
    const h = this.handler
    const handlers: Record<string, any> = {
      open: (ws: any) => h?.open(ws),
      message: (ws: any, msg: any) => h?.message(ws, msg),
      close: (ws: any, code: number, reason: string) => h?.close(ws, code, reason),
      drain: (ws: any) => h?.drain(ws),
    }

    // Pass maxPayloadLength to Bun's WebSocket config if the handler provides it.
    // This enforces a transport-level limit on incoming message sizes.
    if (h && typeof (h as any).getMaxPayloadLength === 'function') {
      handlers.maxPayloadLength = (h as any).getMaxPayloadLength()
    }

    return handlers
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async decryptCookies(request: MantiqRequest): Promise<void> {
    const cookieHeader = request.header('cookie')
    if (!cookieHeader) return

    const cookies = parseCookies(cookieHeader)
    const decrypted: Record<string, string> = {}
    const except = ['XSRF-TOKEN']

    for (const [name, value] of Object.entries(cookies)) {
      if (except.includes(name)) {
        decrypted[name] = value
        continue
      }
      try {
        decrypted[name] = await this.encrypter!.decrypt(value)
      } catch {
        // Can't decrypt — expired key, tampered, or wrong format.
        // Don't pass through the encrypted blob; discard it.
        decrypted[name] = ''
      }
    }

    request.setCookies(decrypted)
  }
}
