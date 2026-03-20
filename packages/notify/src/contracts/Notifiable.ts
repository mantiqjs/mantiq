/**
 * Notifiable entity — any model that can receive notifications.
 *
 * Implement routeNotificationFor() to tell each channel where to deliver:
 *   - 'mail' → return email address
 *   - 'sms' → return phone number
 *   - 'slack' → return Slack channel/webhook
 *   - 'broadcast' → return channel name (defaults to `App.Model.{id}`)
 */
export interface Notifiable {
  /** Return the routing value for a given channel */
  routeNotificationFor(channel: string): string | null

  /** Get the entity's primary key */
  getKey(): any

  /** Get the entity's type name (e.g., 'User') */
  getMorphClass?(): string
}
