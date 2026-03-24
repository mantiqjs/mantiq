import { FormRequest } from '@mantiq/validation'

export class UpdateUserRequest extends FormRequest {
  override rules() {
    return {
      name: 'string|max:255',
      email: 'email|max:255',
      password: 'string|min:6',
    }
  }
}
