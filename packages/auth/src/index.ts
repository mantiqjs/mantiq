// ── Contracts ─────────────────────────────────────────────────────────────────
export type { Authenticatable } from './contracts/Authenticatable.ts'
export type { Guard } from './contracts/Guard.ts'
export type { StatefulGuard } from './contracts/StatefulGuard.ts'
export type { UserProvider } from './contracts/UserProvider.ts'
export type { AuthConfig, GuardConfig, ProviderConfig } from './contracts/AuthConfig.ts'
export type { NewAccessToken } from './contracts/NewAccessToken.ts'

// ── Core ──────────────────────────────────────────────────────────────────────
export { AuthManager } from './AuthManager.ts'
export { AuthServiceProvider } from './AuthServiceProvider.ts'

// ── Guards ────────────────────────────────────────────────────────────────────
export { SessionGuard } from './guards/SessionGuard.ts'
export { RequestGuard } from './guards/RequestGuard.ts'
export { TokenGuard } from './guards/TokenGuard.ts'

// ── Providers ─────────────────────────────────────────────────────────────────
export { DatabaseUserProvider } from './providers/DatabaseUserProvider.ts'

// ── Middleware ─────────────────────────────────────────────────────────────────
export { Authenticate } from './middleware/Authenticate.ts'
export { RedirectIfAuthenticated } from './middleware/RedirectIfAuthenticated.ts'
export { EnsureEmailIsVerified } from './middleware/EnsureEmailIsVerified.ts'
export { ConfirmPassword } from './middleware/ConfirmPassword.ts'
export { CheckAbilities } from './middleware/CheckAbilities.ts'
export { CheckForAnyAbility } from './middleware/CheckForAnyAbility.ts'

// ── Errors ────────────────────────────────────────────────────────────────────
export { AuthenticationError } from './errors/AuthenticationError.ts'

// ── Events ────────────────────────────────────────────────────────────────────
export { Attempting, Authenticated, Login, Failed, Logout, Registered, Lockout } from './events/AuthEvents.ts'

// ── Models ────────────────────────────────────────────────────────────────────
export { PersonalAccessToken } from './models/PersonalAccessToken.ts'

// ── Mixins ────────────────────────────────────────────────────────────────────
export { applyHasApiTokens } from './HasApiTokens.ts'

// ── Migrations ────────────────────────────────────────────────────────────────
export { CreatePersonalAccessTokensTable } from './migrations/CreatePersonalAccessTokensTable.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────
export { sha256 } from './helpers/hash.ts'
export { auth, AUTH_MANAGER } from './helpers/auth.ts'
