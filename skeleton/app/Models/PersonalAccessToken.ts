import { PersonalAccessToken as BaseToken } from '@mantiq/auth'

// Re-export the built-in PersonalAccessToken.
// Extend this class if you need to add custom logic.
export class PersonalAccessToken extends BaseToken {}
