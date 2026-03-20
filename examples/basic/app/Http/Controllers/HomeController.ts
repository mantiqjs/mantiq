import type { MantiqRequest } from '@mantiq/core'
import { html, config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { auth } from '@mantiq/auth'

export class HomeController {
  /** GET / — serves the SPA shell with auth state */
  async index(request: MantiqRequest): Promise<Response> {
    return this.renderSpa(request)
  }

  /** GET /validation — serves the SPA shell on the validation playground page */
  async validation(request: MantiqRequest): Promise<Response> {
    return this.renderSpa(request, 'validation')
  }

  /** GET /cli — serves the SPA shell on the CLI docs page */
  async cli(request: MantiqRequest): Promise<Response> {
    return this.renderSpa(request, 'cli')
  }

  /** GET /storage — serves the SPA shell on the storage showcase page */
  async storage(request: MantiqRequest): Promise<Response> {
    return this.renderSpa(request, 'storage')
  }

  /** GET /chat — serves the SPA shell on the realtime chat page */
  async chat(request: MantiqRequest): Promise<Response> {
    return this.renderSpa(request, 'chat')
  }

  private async renderSpa(request: MantiqRequest, currentPage?: string): Promise<Response> {
    // Try to resolve current user from session (no middleware required)
    const manager = auth()
    manager.setRequest(request)
    let currentUser = null
    try {
      const user = await manager.user()
      if (user) {
        currentUser = {
          id: (user as any).getAttribute?.('id') ?? user.getAuthIdentifier(),
          name: (user as any).getAttribute?.('name') ?? '',
          email: (user as any).getAttribute?.('email') ?? '',
          role: (user as any).getAttribute?.('role') ?? 'user',
        }
      }
    } catch {
      // Not authenticated — that's fine
    }

    return html(
      await vite().page({
        entry: ['src/style.css', 'src/main.tsx'],
        title: config('app.name'),
        data: {
          appName: config('app.name'),
          currentUser,
          ...(currentPage ? { currentPage } : {}),
        },
      }),
    )
  }
}
