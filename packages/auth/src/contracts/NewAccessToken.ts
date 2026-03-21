import type { PersonalAccessToken } from '../models/PersonalAccessToken.ts'

export interface NewAccessToken {
  accessToken: PersonalAccessToken
  plainTextToken: string
}
