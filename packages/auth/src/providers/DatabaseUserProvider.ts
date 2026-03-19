import type { UserProvider } from '../contracts/UserProvider.ts'
import type { Authenticatable } from '../contracts/Authenticatable.ts'
import type { Constructor } from '@mantiq/core'
import type { HashManager } from '@mantiq/core'

/**
 * Retrieves users from the database via a Model class.
 * The model must implement the Authenticatable interface.
 */
export class DatabaseUserProvider implements UserProvider {
  constructor(
    private readonly modelClass: Constructor<any> & { where: any; query: any },
    private readonly hasher: HashManager,
  ) {}

  async retrieveById(identifier: string | number): Promise<Authenticatable | null> {
    const model = this.modelClass as any
    const instance = await model.find(identifier)
    return instance ?? null
  }

  async retrieveByToken(identifier: string | number, token: string): Promise<Authenticatable | null> {
    const model = this.modelClass as any
    // Use a fresh instance to get the remember token column name
    const instance = new this.modelClass() as Authenticatable
    const identifierName = instance.getAuthIdentifierName()
    const tokenName = instance.getRememberTokenName()

    const result = await model
      .where(identifierName, identifier)
      .where(tokenName, token)
      .first()

    return result ?? null
  }

  async updateRememberToken(user: Authenticatable, token: string): Promise<void> {
    user.setRememberToken(token)
    // The user is a Model instance — forceFill bypasses guarded, then save
    const model = user as any
    model.forceFill({ [user.getRememberTokenName()]: token })
    await model.save()
  }

  async retrieveByCredentials(credentials: Record<string, any>): Promise<Authenticatable | null> {
    const model = this.modelClass as any

    // Filter out password — we only query by non-password fields
    const query = Object.entries(credentials)
      .filter(([key]) => key !== 'password')
      .reduce((q, [key, value]) => q.where(key, value), model.query())

    const result = await query.first()
    return result ?? null
  }

  async validateCredentials(user: Authenticatable, credentials: Record<string, any>): Promise<boolean> {
    const password = credentials.password
    if (!password) return false
    return this.hasher.check(password, user.getAuthPassword())
  }

  async rehashPasswordIfRequired(user: Authenticatable, credentials: Record<string, any>): Promise<void> {
    const password = credentials.password
    if (!password) return

    if (this.hasher.needsRehash(user.getAuthPassword())) {
      const newHash = await this.hasher.make(password)
      const model = user as any
      model.forceFill({ [user.getAuthPasswordName()]: newHash })
      await model.save()
    }
  }
}
