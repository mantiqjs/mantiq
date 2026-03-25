import { Model } from '@mantiq/database'

export class TaskLabel extends Model {
  static override table = 'task_labels'
  static override fillable = ['task_id', 'label_id']
  static override guarded = ['id']
  static override timestamps = false

  get taskId(): number { return this.getAttribute('task_id') as number }
  get labelId(): number { return this.getAttribute('label_id') as number }
}
