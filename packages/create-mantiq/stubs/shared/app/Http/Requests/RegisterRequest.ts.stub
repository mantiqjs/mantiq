import { FormRequest } from '@mantiq/validation'

export class RegisterRequest extends FormRequest {
  rules() {
    return {
      name: 'required|string|max:255',
      email: 'required|email|max:255',
      password: 'required|string|min:6',
    }
  }
}
