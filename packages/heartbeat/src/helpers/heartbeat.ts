import type { Heartbeat } from '../Heartbeat.ts'

export const HEARTBEAT = Symbol('Heartbeat')

let _instance: Heartbeat | null = null

export function setHeartbeat(instance: Heartbeat): void {
  _instance = instance
}

export function getHeartbeat(): Heartbeat {
  if (!_instance) throw new Error('Heartbeat not initialized. Register HeartbeatServiceProvider first.')
  return _instance
}

/**
 * Global helper to access the Heartbeat instance.
 */
export function heartbeat(): Heartbeat {
  return getHeartbeat()
}
