import type { Notifiable } from '../src/contracts/Notifiable.ts'
import { Notification } from '../src/Notification.ts'

export function createMockNotifiable(overrides: Partial<{ key: number; routes: Record<string, string>; morphClass: string }> = {}): Notifiable {
  const routes = overrides.routes ?? {}
  return {
    getKey: () => overrides.key ?? 1,
    routeNotificationFor: (channel: string) => routes[channel] ?? null,
    getMorphClass: () => overrides.morphClass ?? 'User',
  }
}

export class TestNotification extends Notification {
  private _via: string[]
  private _payloads: Record<string, any>

  constructor(via: string[], payloads: Record<string, any> = {}) {
    super()
    this._via = via
    this._payloads = payloads
  }

  override via() { return this._via }

  override getPayloadFor(channel: string, _notifiable: any): any {
    return this._payloads[channel]
  }
}

/**
 * Set up a mock fetch that records calls and returns configurable responses.
 * Returns a handle to inspect calls and configure response behavior.
 */
export function setupFetchMock(options: {
  status?: number
  body?: any
  ok?: boolean
} = {}) {
  const status = options.status ?? 200
  const ok = options.ok ?? (status >= 200 && status < 300)
  const responseBody = options.body ?? { ok: true, id: 'test-id' }

  const calls: { url: string; init: any }[] = []

  globalThis.fetch = (async (url: string | URL | Request, init?: any) => {
    calls.push({ url: url.toString(), init })
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as any

  return { calls }
}
