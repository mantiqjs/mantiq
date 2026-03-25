import { Model } from '@mantiq/database'

export class Metric extends Model {
  static override table = 'metrics'
  static override fillable = ['name', 'value', 'unit', 'tags', 'recorded_at']
  static override timestamps = true
  static override casts = { recorded_at: 'datetime' } as const
}
