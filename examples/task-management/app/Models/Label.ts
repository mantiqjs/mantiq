import { Model } from '@mantiq/database'

export class Label extends Model {
  static override table = 'labels'
  static override fillable = ['name', 'color', 'project_id']
  static override guarded = ['id']
  static override timestamps = true

  get name(): string { return this.getAttribute('name') as string }
  get color(): string { return this.getAttribute('color') as string }
  get projectId(): number { return this.getAttribute('project_id') as number }
}
