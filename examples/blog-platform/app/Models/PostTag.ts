import { Model } from '@mantiq/database'

export class PostTag extends Model {
  static override table = 'post_tags'
  static override fillable = ['post_id', 'tag_id']
  static override timestamps = false
}
