import type { MantiqRequest } from '@mantiq/core'
import { json } from '@mantiq/core'
import { Validator, validate, FormRequest } from '@mantiq/validation'
import type { Rule } from '@mantiq/validation'

// ── FormRequest example ─────────────────────────────────────────────────────

class PlaygroundFormRequest extends FormRequest {
  rules() {
    return {
      name: 'required|string|min:2|max:50',
      email: 'required|email',
      age: 'nullable|integer|between:13,120',
      website: 'nullable|url',
      password: 'required|string|min:8',
      password_confirmation: 'required|same:password',
      role: 'required|in:user,admin,editor,viewer',
      bio: 'nullable|string|max:500',
      ip_address: 'nullable|ip',
      metadata: 'nullable|json',
      start_date: 'nullable|date|after:2024-01-01',
      slug: 'nullable|alpha_dash',
      agree_terms: 'required|boolean',
    }
  }

  messages() {
    return {
      'name.required': 'We need your name to continue.',
      'name.min': 'Name is too short — at least :0 characters.',
      'email.required': 'An email address is required.',
      'password.min': 'Password must be at least :0 characters for security.',
      'agree_terms.required': 'You must accept the terms of service.',
      'role.in': 'Pick a valid role: user, admin, editor, or viewer.',
    }
  }

  attributes() {
    return {
      ip_address: 'IP address',
      password_confirmation: 'password confirmation',
      start_date: 'start date',
      agree_terms: 'terms agreement',
    }
  }
}

// ── Controller ──────────────────────────────────────────────────────────────

export class ValidationController {
  /**
   * POST /api/validate/playground
   * Validates form data against a rich set of rules and returns
   * detailed per-field error messages or validated data.
   */
  async playground(request: MantiqRequest): Promise<Response> {
    const formRequest = new PlaygroundFormRequest(request)
    try {
      const data = await formRequest.validate()
      return json({
        success: true,
        message: 'All validation rules passed!',
        validated: data,
        rules: formRequest.rules(),
      })
    } catch (e: any) {
      if (e?.errors) {
        return json({
          success: false,
          errors: e.errors,
          rules: formRequest.rules(),
        }, 422)
      }
      throw e
    }
  }

  /**
   * POST /api/validate/inline
   * Demonstrates the inline validate() helper — same rules, simpler API.
   */
  async inline(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    try {
      const data = await validate(body, {
        name: 'required|string|min:2|max:50',
        email: 'required|email',
        score: 'required|numeric|between:0,100',
      })
      return json({ success: true, validated: data })
    } catch (e: any) {
      if (e?.errors) {
        return json({ success: false, errors: e.errors }, 422)
      }
      throw e
    }
  }

  /**
   * POST /api/validate/custom-rule
   * Demonstrates custom Rule objects passed in the array syntax.
   */
  async customRule(request: MantiqRequest): Promise<Response> {
    const body = await request.input()

    const noSpaces: Rule = {
      name: 'no_spaces',
      validate: (v, field) =>
        !/\s/.test(String(v)) || `The ${field} field must not contain spaces.`,
    }

    const divisibleBy: Rule = {
      name: 'divisible_by',
      validate: (v, field, _data, [n]) =>
        Number(v) % Number(n) === 0 || `The ${field} must be divisible by ${n}.`,
    }

    try {
      const v = new Validator(body, {
        username: ['required', 'string', 'min:3', noSpaces],
        lucky_number: ['required', 'integer', divisibleBy],
      })
      const data = await v.validate()
      return json({ success: true, validated: data })
    } catch (e: any) {
      if (e?.errors) {
        return json({ success: false, errors: e.errors }, 422)
      }
      throw e
    }
  }

  /**
   * POST /api/validate/test
   * Generic endpoint — accepts { data, rules } and validates.
   * Used by the rule-by-rule showcase in the frontend.
   */
  async test(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    const data = body.data ?? {}
    const rules = body.rules ?? {}
    try {
      const v = new Validator(data, rules)
      const validated = await v.validate()
      return json({ success: true, validated })
    } catch (e: any) {
      if (e?.errors) {
        return json({ success: false, errors: e.errors }, 422)
      }
      throw e
    }
  }

  /**
   * GET /api/validate/rules
   * Returns the rule definitions used by the playground so the
   * frontend can display them next to each field.
   */
  rules(_request: MantiqRequest): Response {
    const request = new PlaygroundFormRequest(_request)
    return json({
      rules: request.rules(),
      messages: request.messages(),
      attributes: request.attributes(),
    })
  }
}
