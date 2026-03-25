import { Model } from '@mantiq/database'

export class Comment extends Model {
  static override table = 'comments'
  static override fillable = ['body', 'post_id', 'user_id', 'parent_id', 'status']
  static override timestamps = true
}
