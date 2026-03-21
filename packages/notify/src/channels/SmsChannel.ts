import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import type { SmsConfig } from '../contracts/NotifyConfig.ts'
import { NotifyError } from '../errors/NotifyError.ts'

/**
 * Sends SMS notifications via Twilio or Vonage.
 *
 * The notification's `toSms(notifiable)` method should return an `SmsPayload`
 * with `{ to?, body }`. If `to` is not set, falls back to
 * `notifiable.routeNotificationFor('sms')`.
 *
 * Uses native `fetch()` — no SDK dependencies required.
 */
export class SmsChannel implements NotificationChannel {
  readonly name = 'sms'

  constructor(private readonly config: SmsConfig) {}

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('sms', notifiable)
    if (!payload) return

    const to = payload.to ?? notifiable.routeNotificationFor('sms')
    if (!to) {
      throw new NotifyError('No SMS recipient: payload.to is empty and notifiable returned null for sms route', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const body: string = payload.body
    if (!body) {
      throw new NotifyError('SMS body is required', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    switch (this.config.driver) {
      case 'twilio':
        await this.sendViaTwilio(to, body)
        break
      case 'vonage':
        await this.sendViaVonage(to, body)
        break
      default:
        throw new NotifyError(`Unsupported SMS driver: ${this.config.driver}`, {
          channel: this.name,
          notificationType: notification.type,
        })
    }
  }

  /**
   * Send an SMS via the Twilio REST API.
   * POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
   * with form-encoded body and HTTP Basic auth (sid:token).
   */
  private async sendViaTwilio(to: string, body: string): Promise<void> {
    const twilio = this.config.twilio
    if (!twilio) {
      throw new NotifyError('Twilio configuration is missing (twilio.sid, twilio.token, twilio.from)', {
        channel: this.name,
        driver: 'twilio',
      })
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.sid}/Messages.json`
    const credentials = btoa(`${twilio.sid}:${twilio.token}`)

    const formData = new URLSearchParams()
    formData.set('To', to)
    formData.set('From', twilio.from)
    formData.set('Body', body)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Twilio API error (${response.status}): ${errorBody}`, {
        channel: this.name,
        driver: 'twilio',
        statusCode: response.status,
      })
    }
  }

  /**
   * Send an SMS via the Vonage (Nexmo) REST API.
   * POST https://rest.nexmo.com/sms/json with JSON body.
   */
  private async sendViaVonage(to: string, body: string): Promise<void> {
    const vonage = this.config.vonage
    if (!vonage) {
      throw new NotifyError('Vonage configuration is missing (vonage.apiKey, vonage.apiSecret, vonage.from)', {
        channel: this.name,
        driver: 'vonage',
      })
    }

    const url = 'https://rest.nexmo.com/sms/json'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: vonage.apiKey,
        api_secret: vonage.apiSecret,
        from: vonage.from,
        to,
        text: body,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Vonage API error (${response.status}): ${errorBody}`, {
        channel: this.name,
        driver: 'vonage',
        statusCode: response.status,
      })
    }

    // Vonage returns 200 even on failure — check the response body
    const result: any = await response.json().catch(() => null)
    if (result?.messages?.[0]?.status !== '0') {
      const errorText = result?.messages?.[0]?.['error-text'] ?? 'Unknown Vonage error'
      throw new NotifyError(`Vonage delivery failed: ${errorText}`, {
        channel: this.name,
        driver: 'vonage',
        vonageStatus: result?.messages?.[0]?.status,
      })
    }
  }
}
