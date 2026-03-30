import type { Container } from '@mantiq/core'
import { PanelManager } from '../panel/PanelManager.ts'

/**
 * Symbol used to bind the PanelManager in the service container.
 */
export const STUDIO = Symbol.for('studio.panelManager')

/**
 * Helper function to resolve the PanelManager from the container.
 */
export function studio(container: Container): PanelManager {
  return container.make(PanelManager)
}
