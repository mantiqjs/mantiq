import { Action } from './Action.ts'
import type { ActionResult } from './Action.ts'

export class CreateAction extends Action {
  static make(name: string = 'create'): CreateAction {
    const action = new CreateAction(name)
    action._label = 'Create'
    action._icon = 'plus'
    action._color = 'primary'
    return action
  }

  override handle(_record: Record<string, unknown>, _data?: Record<string, unknown>): ActionResult {
    return {
      type: 'success',
      message: 'Record created successfully.',
      redirectUrl: undefined,
    }
  }
}
