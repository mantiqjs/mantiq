import { Action } from './Action.ts'
import type { ActionResult } from './Action.ts'

export class DeleteAction extends Action {
  static make(name: string = 'delete'): DeleteAction {
    const action = new DeleteAction(name)
    action._label = 'Delete'
    action._icon = 'trash'
    action._color = 'danger'
    action._requiresConfirmation = true
    action._confirmation = {
      title: 'Delete record',
      description: 'Are you sure you want to delete this record? This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    }
    return action
  }

  override handle(_record: Record<string, unknown>, _data?: Record<string, unknown>): ActionResult {
    return {
      type: 'success',
      message: 'Record deleted successfully.',
      redirectUrl: undefined,
    }
  }
}
