import { PersonalAccessToken } from './models/PersonalAccessToken.ts'
import { sha256 } from './helpers/hash.ts'
import type { NewAccessToken } from './contracts/NewAccessToken.ts'

export function applyHasApiTokens(ModelClass: any): void {
  // Store current access token on instance
  const proto = ModelClass.prototype

  proto.createToken = async function(name: string, abilities: string[] = ['*'], expiresAt?: Date): Promise<NewAccessToken> {
    // #212: Default empty abilities to ['*'] (full access) and deduplicate.
    // An empty abilities array would silently deny all permission checks,
    // which is almost certainly not the caller's intent.
    if (abilities.length === 0) {
      abilities = ['*']
    }
    abilities = [...new Set(abilities)]

    // Generate 64 random hex characters
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    const plaintext = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')

    const hash = await sha256(plaintext)

    const ctor = this.constructor as any
    const token = await PersonalAccessToken.create({
      tokenable_type: ctor.table ?? ctor.name?.toLowerCase() + 's',
      tokenable_id: this.getKey(),
      name,
      token: hash,
      abilities: JSON.stringify(abilities),
      expires_at: expiresAt?.toISOString() ?? null,
    })

    const id = token.getKey()
    return {
      accessToken: token,
      plainTextToken: `${id}|${plaintext}`,
    }
  }

  proto.tokens = function() {
    const ctor = this.constructor as any
    return PersonalAccessToken.where('tokenable_type', ctor.table ?? ctor.name?.toLowerCase() + 's')
      .where('tokenable_id', this.getKey())
  }

  proto.currentAccessToken = function(): PersonalAccessToken | null {
    return this._currentAccessToken ?? null
  }

  proto.withAccessToken = function(token: PersonalAccessToken): any {
    this._currentAccessToken = token
    return this
  }

  proto.tokenCan = function(ability: string): boolean {
    const token = this.currentAccessToken()
    if (!token) return false
    return token.can(ability)
  }

  proto.tokenCant = function(ability: string): boolean {
    return !this.tokenCan(ability)
  }
}
