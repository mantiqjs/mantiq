import type { GateManager } from './GateManager.ts'
import type { AuthorizationResponse } from './AuthorizationResponse.ts'

/**
 * A gate scoped to a specific user for convenience.
 *
 * @example
 * const userGate = gate().forUser(user)
 * if (await userGate.can('edit', post)) { ... }
 */
export class UserGate {
  constructor(
    private readonly gate: GateManager,
    private readonly user: any,
  ) {}

  async can(ability: string, ...args: any[]): Promise<boolean> {
    return this.gate.allows(ability, this.user, ...args)
  }

  async cannot(ability: string, ...args: any[]): Promise<boolean> {
    return this.gate.denies(ability, this.user, ...args)
  }

  async authorize(ability: string, ...args: any[]): Promise<AuthorizationResponse> {
    return this.gate.authorize(ability, this.user, ...args)
  }
}
