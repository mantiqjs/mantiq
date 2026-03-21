import type { MantiqRequest } from '@mantiq/core'

export class CheckForAnyAbility {
  private abilities: string[] = []

  setParameters(...abilities: string[]): void {
    this.abilities = abilities
  }

  async handle(request: MantiqRequest, next: () => Promise<Response>): Promise<Response> {
    const user = request.user<any>()
    if (!user || typeof user.tokenCan !== 'function') {
      return new Response(JSON.stringify({ message: 'Unauthorized.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const hasAny = this.abilities.some(ability => user.tokenCan(ability))
    if (!hasAny) {
      return new Response(JSON.stringify({ message: 'Insufficient abilities.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    return next()
  }
}
