import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import type { WebhookPayload } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

/**
 * Delivers notifications via outgoing HTTP webhooks.
 *
 * The notification's `toWebhook(notifiable)` method should return a
 * `WebhookPayload` with `{ url, body, method?, headers? }`.
 *
 * Sends JSON to the specified URL using native `fetch()`.
 * Defaults to POST if no method is specified.
 */
export class WebhookChannel implements NotificationChannel {
  readonly name = 'webhook'

  /**
   * Security: validate webhook URL to prevent SSRF attacks.
   * Rejects private/reserved IP ranges, localhost, link-local, and non-http(s) schemes
   * so that attackers cannot target internal services (e.g. cloud metadata at 169.254.169.254).
   */
  private validateUrl(url: string): void {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new NotifyError('Webhook URL is not a valid URL', {
        channel: this.name,
        url,
      })
    }

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new NotifyError(`Webhook URL scheme "${parsed.protocol}" is not allowed — only http and https`, {
        channel: this.name,
        url,
      })
    }

    const hostname = parsed.hostname

    // Reject IPv6 addresses in brackets
    const ipv6Match = hostname.match(/^\[(.+)\]$/)
    if (ipv6Match) {
      const ipv6 = ipv6Match[1]!.toLowerCase()
      // Reject loopback (::1), link-local (fe80::), unique-local (fc00::/7 = fc and fd)
      if (
        ipv6 === '::1' ||
        ipv6.startsWith('fe80:') ||
        ipv6.startsWith('fc') ||
        ipv6.startsWith('fd')
      ) {
        throw new NotifyError('Webhook URL targets a private/reserved network address', {
          channel: this.name,
          url,
        })
      }
    }

    // Reject known private/reserved IPv4 ranges and localhost
    const lower = hostname.toLowerCase()
    if (
      lower === 'localhost' ||
      lower.endsWith('.localhost') ||
      lower === '[::1]'
    ) {
      throw new NotifyError('Webhook URL targets a private/reserved network address', {
        channel: this.name,
        url,
      })
    }

    // Check IPv4-like hostnames
    const ipv4Parts = hostname.split('.')
    if (ipv4Parts.length === 4 && ipv4Parts.every((p) => /^\d{1,3}$/.test(p))) {
      const octets = ipv4Parts.map(Number)
      const [a, b] = octets as [number, number, number, number]

      if (
        a === 127 ||                           // 127.0.0.0/8 — loopback
        a === 10 ||                            // 10.0.0.0/8 — private
        (a === 172 && b >= 16 && b <= 31) ||   // 172.16.0.0/12 — private
        (a === 192 && b === 168) ||            // 192.168.0.0/16 — private
        (a === 169 && b === 254) ||            // 169.254.0.0/16 — link-local (AWS metadata)
        a === 0                                // 0.0.0.0/8
      ) {
        throw new NotifyError('Webhook URL targets a private/reserved network address', {
          channel: this.name,
          url,
        })
      }
    }
  }

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('webhook', notifiable) as WebhookPayload | undefined
    if (!payload) return

    if (!payload.url) {
      throw new NotifyError('Webhook URL is required', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    // Security: validate URL before making the request to prevent SSRF
    this.validateUrl(payload.url)

    const method = payload.method ?? 'POST'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...payload.headers,
    }

    let response: Response
    try {
      response = await fetch(payload.url, {
        method,
        headers,
        body: JSON.stringify(payload.body),
      })
    } catch (error) {
      throw new NotifyError(`Webhook request failed: ${error instanceof Error ? error.message : String(error)}`, {
        channel: this.name,
        notificationType: notification.type,
        url: payload.url,
        method,
      })
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Webhook returned ${response.status}: ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        url: payload.url,
        method,
        statusCode: response.status,
      })
    }
  }
}
