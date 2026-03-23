import { Model } from '@mantiq/database'
import { AuthenticatableModel } from '@mantiq/auth'

export class User extends AuthenticatableModel(Model) {
  static override fillable = ['name', 'email', 'password']
  static override hidden = ['password', 'remember_token']
}
