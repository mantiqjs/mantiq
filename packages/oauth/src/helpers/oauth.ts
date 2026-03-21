import { Application } from '@mantiq/core'
import type { OAuthServer } from '../OAuthServer.ts'

export const OAUTH_SERVER = Symbol('OAuthServer')

/**
 * Access the OAuthServer singleton.
 *
 * @example
 *   const server = oauth()
 *   server.tokensCan({ 'read': 'Read data', 'write': 'Write data' })
 */
export function oauth(): OAuthServer {
  return Application.getInstance().make<OAuthServer>(OAUTH_SERVER)
}
