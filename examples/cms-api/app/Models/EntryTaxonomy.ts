import { Model } from '@mantiq/database'

export class EntryTaxonomy extends Model {
  static override table = 'entry_taxonomies'
  static override fillable = ['entry_id', 'taxonomy_id']
  static override guarded = ['id']
  static override timestamps = false
}
