import type { MantiqRequest } from '@mantiq/core'

export interface OAuthTokenResponse {
  token_type: 'Bearer'
  expires_in: number
  access_token: string
  refresh_token?: string | undefined
  scope?: string | undefined
}

export interface GrantHandler {
  readonly grantType: string
  handle(request: MantiqRequest): Promise<OAuthTokenResponse>
}
