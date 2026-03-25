import { Model } from '@mantiq/database'

export class Project extends Model {
  static override table = 'projects'
  static override fillable = ['name', 'description', 'user_id', 'status', 'color']
  static override guarded = ['id']
  static override timestamps = true

  get name(): string { return this.getAttribute('name') as string }
  get description(): string | null { return this.getAttribute('description') as string | null }
  get userId(): number { return this.getAttribute('user_id') as number }
  get status(): string { return this.getAttribute('status') as string }
  get color(): string { return this.getAttribute('color') as string }

  isActive(): boolean { return this.status === 'active' }
  isArchived(): boolean { return this.status === 'archived' }
}
