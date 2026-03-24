import { Enum } from '@mantiq/core'

export class UserStatus extends Enum {
  static Active = new UserStatus('active')
  static Inactive = new UserStatus('inactive')
  static Banned = new UserStatus('banned')
}
