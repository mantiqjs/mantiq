import { Model } from '@mantiq/database'
import type { Authenticatable } from '@mantiq/auth'

export class User extends Model implements Authenticatable {
  static override table = 'users'
  static override fillable = ['name', 'email', 'password', 'role']
  static override guarded = ['id']
  static override hidden = ['password', 'remember_token']
  static override timestamps = true

  getAuthIdentifierName(): string { return 'id' }
  getAuthIdentifier(): number { return this.getAttribute('id') as number }
  getAuthPasswordName(): string { return 'password' }
  getAuthPassword(): string { return this.getAttribute('password') as string }
  getRememberToken(): string | null { return (this.getAttribute('remember_token') as string) ?? null }
  setRememberToken(token: string | null): void { this.setAttribute('remember_token', token) }
  getRememberTokenName(): string { return 'remember_token' }
}
