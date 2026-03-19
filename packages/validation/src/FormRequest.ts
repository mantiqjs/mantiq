import type { MantiqRequest } from '@mantiq/core'
import { ForbiddenError } from '@mantiq/core'
import { Validator, type RuleDefinition } from './Validator.ts'
import type { Rule } from './contracts/Rule.ts'

/**
 * Base form request — subclass this to declare validation rules and
 * authorization logic for a specific endpoint.
 *
 * @example
 *   class StoreUserRequest extends FormRequest {
 *     rules() {
 *       return { name: 'required|string|max:255', email: 'required|email' }
 *     }
 *     authorize() {
 *       return this.request.isAuthenticated()
 *     }
 *   }
 *
 *   // In a controller:
 *   const data = await new StoreUserRequest(request).validate()
 */
export abstract class FormRequest {
  protected _validator: Validator | null = null

  constructor(protected readonly request: MantiqRequest) {}

  /** Define the validation rules for this request. */
  abstract rules(): Record<string, RuleDefinition>

  /** Determine if the user is authorized to make this request. Defaults to true. */
  authorize(): boolean | Promise<boolean> {
    return true
  }

  /** Custom error messages keyed by 'field.rule' or 'rule'. */
  messages(): Record<string, string> {
    return {}
  }

  /** Custom attribute names for error message replacement. */
  attributes(): Record<string, string> {
    return {}
  }

  /**
   * Run authorization + validation. Returns validated data or throws.
   * Throws ForbiddenError (403) if unauthorized, ValidationError (422) if invalid.
   */
  async validate(): Promise<Record<string, any>> {
    const authorized = await this.authorize()
    if (!authorized) {
      throw new ForbiddenError('This action is unauthorized.')
    }

    const data = await this.data()
    this._validator = new Validator(data, this.rules(), this.messages(), this.attributes())
    this.configureValidator(this._validator)
    return this._validator.validate()
  }

  /** Override to customize which data is validated (defaults to all input). */
  protected async data(): Promise<Record<string, any>> {
    return this.request.input()
  }

  /** Override to configure the validator (e.g., set a presence verifier). */
  protected configureValidator(_validator: Validator): void {}

  /** Access the validator after validate() has been called. */
  get validator(): Validator | null {
    return this._validator
  }

  /** Access validation errors after validate() has been called. */
  get errors(): Record<string, string[]> {
    return this._validator?.errors() ?? {}
  }
}
