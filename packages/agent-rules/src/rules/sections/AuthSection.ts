import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class AuthSection implements RuleSection {
  readonly id = 'auth'
  readonly title = 'Authentication (@mantiq/auth)'
  readonly requires = ['auth']

  render(_packages: DetectedPackage[]): string {
    return `- User model uses \`AuthenticatableModel\` mixin: \`class User extends AuthenticatableModel(Model)\`
- Guards: \`web\` (session-based), \`api\` (token-based)
- Middleware: \`auth\` (require authentication), \`guest\` (require no auth)
- Token auth: \`user.createToken('name')\` returns \`{ plainTextToken, accessToken }\`
- CSRF: web routes are protected by \`VerifyCsrfToken\` middleware. Use \`X-XSRF-TOKEN\` header for AJAX.
- Password hashing: use \`HashManager\` from \`@mantiq/core\`, never store plain text`
  }
}
