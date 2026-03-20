import { Model } from '@mantiq/database'

export class DatabaseNotification extends Model {
  static override table = 'notifications'
  static override primaryKey = 'id'
  static override fillable = ['id', 'type', 'notifiable_type', 'notifiable_id', 'data', 'read_at']
  static override timestamps = true
  static override casts = { data: 'json' as const }

  get isRead(): boolean {
    return this.getAttribute('read_at') != null
  }

  get isUnread(): boolean {
    return !this.isRead
  }

  async markAsRead(): Promise<this> {
    this.setAttribute('read_at', new Date().toISOString())
    await this.save()
    return this
  }

  async markAsUnread(): Promise<this> {
    this.setAttribute('read_at', null)
    await this.save()
    return this
  }
}
