import type { MantiqRequest } from '@mantiq/core'

export class CheckAbilities {
  private abilities: string[] = []

  setParameters(...abilities: string[]): void {
    this.abilities = abilities
  }

  async handle(request: MantiqRequest, next: () => Promise<Response>): Promise<Response> {
    const user = request.user<any>()
    if (!user || typeof user.tokenCan !== 'function') {
      return new Response(JSON.stringify({ message: 'Unauthorized.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    for (const ability of this.abilities) {
      if (!user.tokenCan(ability)) {
        return new Response(JSON.stringify({ message: `Missing ability: ${ability}` }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      }
    }

    return next()
  }
}
