import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

const SCOPES = [
  { name: 'read', description: 'Read access to protected resources.' },
  { name: 'write', description: 'Write access to protected resources.' },
  { name: 'delete', description: 'Delete access to protected resources.' },
  { name: 'admin', description: 'Full administrative access.' },
  { name: 'profile:read', description: 'Read the authenticated user profile.' },
  { name: 'profile:write', description: 'Update the authenticated user profile.' },
  { name: 'users:read', description: 'Read other user profiles.' },
  { name: 'users:write', description: 'Create and update other user accounts.' },
]

export class ScopeController {
  async index(_request: MantiqRequest): Promise<Response> {
    return MantiqResponse.json({ data: SCOPES })
  }
}
