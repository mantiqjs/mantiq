import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'
import { SessionManager } from '../session/SessionManager.ts'
import { SessionStore } from '../session/Store.ts'
import { CookieSessionHandler } from '../session/handlers/CookieSessionHandler.ts'
import { serializeCookie } from '../http/Cookie.ts'

/**
 * Middleware that starts a session on each request.
 *
 * Lifecycle:
 * 1. Read session ID from cookie (or generate a new one)
 * 2. Load session data from the handler
 * 3. Attach session to request
 * 4. Call next()
 * 5. Age flash data
 * 6. Save session
 * 7. Attach session cookie to response
 */
export class StartSession implements Middleware {
  constructor(private readonly manager: SessionManager) {}

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const config = this.manager.getConfig()
    const handler = this.manager.driver()

    // Read session ID from cookie
    const sessionId = request.cookie(config.cookie) ?? SessionStore.generateId()

    // For cookie driver: seed data from cookie before starting
    if (handler instanceof CookieSessionHandler) {
      const cookieData = request.cookie(config.cookie + '_data') ?? ''
      if (cookieData) {
        try {
          handler.setDataFromCookie(sessionId, decodeURIComponent(cookieData))
        } catch {
          // Invalid cookie data — will start fresh
        }
      }
    }

    // Create and start session
    const session = new SessionStore(config.cookie, handler, sessionId)
    await session.start()

    // Attach to request
    request.setSession(session)

    // Process request
    const response = await next()

    // Age flash data
    session.ageFlashData()

    // Save session
    await session.save()

    // Attach cookie to response
    return this.addCookieToResponse(response, session, config)
  }

  private addCookieToResponse(
    response: Response,
    session: SessionStore,
    config: ReturnType<SessionManager['getConfig']>,
  ): Response {
    const headers = new Headers(response.headers)

    // Session ID cookie
    const cookieOpts: Record<string, any> = {
      path: config.path,
      secure: config.secure,
      httpOnly: config.httpOnly,
      sameSite: config.sameSite,
      maxAge: config.lifetime * 60,
    }
    if (config.domain) cookieOpts.domain = config.domain

    headers.append(
      'Set-Cookie',
      serializeCookie(session.getName(), session.getId(), cookieOpts),
    )

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
