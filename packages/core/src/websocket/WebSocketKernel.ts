import type { WebSocketHandler } from './WebSocketContext.ts'
import type { AesEncrypter } from '../encryption/Encrypter.ts'
import { MantiqRequest } from '../http/Request.ts'
import { parseCookies } from '../http/Cookie.ts'

/**
 * Handles WebSocket upgrade detection and lifecycle delegation.
 *
 * Core only provides the infrastructure — @mantiq/realtime registers
 * its handler via registerHandler(). Without it, all upgrades return 426.
 */
export class WebSocketKernel {
  private handler: WebSocketHandler | null = null
  private encrypter: AesEncrypter | null = null

  /**
   * Called by @mantiq/realtime to register its WebSocket handler.
   */
  registerHandler(handler: WebSocketHandler): void {
    this.handler = handler
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
   */
  getBunHandlers(): object {
    const h = this.handler
    return {
      open: (ws: any) => h?.open(ws),
      message: (ws: any, msg: any) => h?.message(ws, msg),
      close: (ws: any, code: number, reason: string) => h?.close(ws, code, reason),
      drain: (ws: any) => h?.drain(ws),
    }
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
        decrypted[name] = value
      }
    }

    request.setCookies(decrypted)
  }
}
