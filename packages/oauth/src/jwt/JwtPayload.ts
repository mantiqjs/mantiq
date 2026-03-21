export interface JwtPayload {
  iss?: string | undefined
  sub?: string | undefined
  aud?: string | undefined
  exp?: number | undefined
  iat?: number | undefined
  jti?: string | undefined
  scopes?: string[] | undefined
}
