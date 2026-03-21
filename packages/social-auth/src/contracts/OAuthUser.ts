export interface OAuthUser {
  id: string
  name: string | null
  email: string | null
  avatar: string | null
  token: string
  refreshToken: string | null
  expiresIn: number | null
  raw: Record<string, any>
}
