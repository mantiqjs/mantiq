import { Model } from '@mantiq/database'

export class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'slug', 'excerpt', 'content', 'user_id', 'category_id', 'status', 'published_at', 'featured_image']
  static override timestamps = true
  static override casts = { published_at: 'datetime' } as const
}
