import { Action } from './Action.ts'
import type { ActionResult } from './Action.ts'

export class EditAction extends Action {
  static make(name: string = 'edit'): EditAction {
    const action = new EditAction(name)
    action._label = 'Edit'
    action._icon = 'pencil'
    action._color = 'primary'
    return action
  }

  override handle(_record: Record<string, unknown>, _data?: Record<string, unknown>): ActionResult {
    return {
      type: 'success',
      message: 'Record updated successfully.',
      redirectUrl: undefined,
    }
  }
}
