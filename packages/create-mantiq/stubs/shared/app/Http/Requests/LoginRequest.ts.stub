import { FormRequest } from '@mantiq/validation'

export class LoginRequest extends FormRequest {
  override rules() {
    return {
      email: 'required|email',
      password: 'required|string',
    }
  }
}
