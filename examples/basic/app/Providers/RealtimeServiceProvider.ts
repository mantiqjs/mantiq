import { RealtimeServiceProvider as BaseProvider } from '@mantiq/realtime'
import { realtime } from '@mantiq/realtime'

/**
 * App-level Realtime service provider.
 *
 * Sets up WebSocket authentication and channel authorization.
 */
export class RealtimeServiceProvider extends BaseProvider {
  override boot(): void {
    super.boot()

    const server = realtime()

    // ── WebSocket Authentication ──────────────────────────────────────────
    // For the demo, we authenticate via query params passed from the client.
    // In production, you'd verify the session cookie or JWT token here.
    server.authenticate(async (request) => {
      const userId = request.query('userId')
      const name = request.query('name')
      const email = request.query('email')

      if (!userId || !name) {
        return null // Reject unauthenticated connections
      }

      return {
        userId: Number(userId),
        metadata: { name, email: email || '' },
      }
    })

    // ── Channel Authorization ─────────────────────────────────────────────
    // Allow all authenticated users to join the chat lobby
    server.channels.authorize('chat.*', (userId, _channel, metadata) => {
      // Return member info for presence channels
      return {
        name: metadata?.name ?? `User ${userId}`,
        email: metadata?.email ?? '',
      }
    })
  }
}
