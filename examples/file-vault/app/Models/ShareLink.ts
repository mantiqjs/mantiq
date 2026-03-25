import { Model } from '@mantiq/database'

export class ShareLink extends Model {
  static override table = 'share_links'
  static override fillable = ['file_id', 'token', 'created_by', 'expires_at', 'max_downloads', 'download_count', 'password_hash', 'is_active']
  static override timestamps = true
  static override casts = { expires_at: 'datetime' } as const
}
