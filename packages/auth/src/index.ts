// ── Contracts ─────────────────────────────────────────────────────────────────
export type { Authenticatable } from './contracts/Authenticatable.ts'
export type { Guard } from './contracts/Guard.ts'
export type { StatefulGuard } from './contracts/StatefulGuard.ts'
export type { UserProvider } from './contracts/UserProvider.ts'
export type { AuthConfig, GuardConfig, ProviderConfig } from './contracts/AuthConfig.ts'

// ── Core ──────────────────────────────────────────────────────────────────────
export { AuthManager } from './AuthManager.ts'
export { AuthServiceProvider } from './AuthServiceProvider.ts'

// ── Guards ────────────────────────────────────────────────────────────────────
export { SessionGuard } from './guards/SessionGuard.ts'
export { RequestGuard } from './guards/RequestGuard.ts'

// ── Providers ─────────────────────────────────────────────────────────────────
export { DatabaseUserProvider } from './providers/DatabaseUserProvider.ts'

// ── Middleware ─────────────────────────────────────────────────────────────────
export { Authenticate } from './middleware/Authenticate.ts'
export { RedirectIfAuthenticated } from './middleware/RedirectIfAuthenticated.ts'
export { EnsureEmailIsVerified } from './middleware/EnsureEmailIsVerified.ts'
export { ConfirmPassword } from './middleware/ConfirmPassword.ts'

// ── Errors ────────────────────────────────────────────────────────────────────
export { AuthenticationError } from './errors/AuthenticationError.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────
export { auth, AUTH_MANAGER } from './helpers/auth.ts'
