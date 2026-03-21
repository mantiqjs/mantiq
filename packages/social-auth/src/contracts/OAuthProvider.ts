import type { OAuthUser } from './OAuthUser.ts'

export interface OAuthProvider {
  readonly name: string
  redirect(): Response
  user(request: any): Promise<OAuthUser>
  userFromToken(accessToken: string): Promise<OAuthUser>
  scopes(scopes: string[]): this
  with(params: Record<string, string>): this
  stateless(): this
}
