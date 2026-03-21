import type { GateManager } from '../authorization/GateManager.ts'

let _gate: GateManager | null = null

export const GATE_MANAGER = Symbol('GateManager')

export function setGateManager(g: GateManager): void {
  _gate = g
}

/**
 * Access the gate manager singleton.
 *
 * @example gate().allows('edit-post', user, post)
 * @example gate().forUser(user).can('edit-post', post)
 */
export function gate(): GateManager {
  if (!_gate) {
    throw new Error('Gate manager not initialized. Register AuthServiceProvider.')
  }
  return _gate
}
