import { Action } from './Action.ts'
import type { ActionResult } from './Action.ts'

export class ViewAction extends Action {
  static make(name: string = 'view'): ViewAction {
    const action = new ViewAction(name)
    action._label = 'View'
    action._icon = 'eye'
    action._color = 'secondary'
    return action
  }

  override handle(_record: Record<string, unknown>, _data?: Record<string, unknown>): ActionResult {
    return {
      type: 'success',
      message: undefined,
      redirectUrl: undefined,
    }
  }
}
