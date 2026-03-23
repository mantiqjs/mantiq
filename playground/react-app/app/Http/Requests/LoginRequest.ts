import { FormRequest } from '@mantiq/validation'

export class LoginRequest extends FormRequest {
  rules() {
    return {
      email: 'required|email',
      password: 'required|string',
    }
  }
}
