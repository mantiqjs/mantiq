export interface JwtPayload {
  iss?: string
  sub?: string
  aud?: string
  exp?: number
  iat?: number
  jti?: string
  scopes?: string[]
}
