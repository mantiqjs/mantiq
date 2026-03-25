import { Model } from '@mantiq/database'

export class Task extends Model {
  static override table = 'tasks'
  static override fillable = [
    'title', 'description', 'project_id', 'assignee_id', 'reporter_id',
    'status', 'priority', 'due_date', 'completed_at', 'position',
  ]
  static override guarded = ['id']
  static override timestamps = true

  static readonly VALID_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const
  static readonly VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

  /** Allowed status transitions: from -> [to, ...] */
  static readonly TRANSITIONS: Record<string, readonly string[]> = {
    todo:        ['in_progress'],
    in_progress: ['in_review', 'todo'],
    in_review:   ['done', 'in_progress'],
    done:        ['in_progress'],
  }

  get title(): string { return this.getAttribute('title') as string }
  get projectId(): number { return this.getAttribute('project_id') as number }
  get assigneeId(): number | null { return this.getAttribute('assignee_id') as number | null }
  get reporterId(): number { return this.getAttribute('reporter_id') as number }
  get status(): string { return this.getAttribute('status') as string }
  get priority(): string { return this.getAttribute('priority') as string }
  get position(): number { return this.getAttribute('position') as number }

  canTransitionTo(newStatus: string): boolean {
    const allowed = Task.TRANSITIONS[this.status]
    return allowed ? allowed.includes(newStatus) : false
  }
}
