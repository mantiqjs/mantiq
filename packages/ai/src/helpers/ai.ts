import { Application } from '@mantiq/core'
import type { AIManager } from '../AIManager.ts'
import type { PendingChat } from '../PendingChat.ts'

export const AI_MANAGER = Symbol('AIManager')

/**
 * Global AI helper.
 *
 * @example
 *   ai()                     // Get the AIManager instance
 *   ai('gpt-4o')             // Start a PendingChat with a model
 *   ai().driver('anthropic') // Get a specific driver
 */
export function ai(): AIManager
export function ai(model: string): PendingChat
export function ai(model?: string): AIManager | PendingChat {
  const manager = Application.getInstance().make<AIManager>(AI_MANAGER)
  if (model === undefined) return manager
  return manager.chat(model)
}
