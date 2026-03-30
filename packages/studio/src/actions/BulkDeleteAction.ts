import { BulkAction } from './BulkAction.ts'
import type { ActionResult } from './Action.ts'

export class BulkDeleteAction extends BulkAction {
  static make(name: string = 'bulk-delete'): BulkDeleteAction {
    const action = new BulkDeleteAction(name)
    action._label = 'Delete selected'
    action._icon = 'trash'
    action._color = 'danger'
    action._requiresConfirmation = true
    action._confirmation = {
      title: 'Delete selected records',
      description: 'Are you sure you want to delete the selected records? This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    }
    return action
  }

  override handle(_records: Record<string, unknown>[], _data?: Record<string, unknown>): ActionResult {
    return {
      type: 'success',
      message: 'Records deleted successfully.',
      redirectUrl: undefined,
    }
  }
}
