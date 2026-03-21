export class AuthorizationResponse {
  private _allowed: boolean
  private _message: string | null
  private _code: number | null

  constructor(allowed: boolean, message?: string, code?: number) {
    this._allowed = allowed
    this._message = message ?? null
    this._code = code ?? null
  }

  allowed(): boolean {
    return this._allowed
  }

  denied(): boolean {
    return !this._allowed
  }

  message(): string | null {
    return this._message
  }

  code(): number | null {
    return this._code
  }

  static allow(message?: string): AuthorizationResponse {
    return new AuthorizationResponse(true, message)
  }

  static deny(message?: string, code?: number): AuthorizationResponse {
    return new AuthorizationResponse(false, message ?? 'This action is unauthorized.', code ?? 403)
  }
}
