// ── JWT ──────────────────────────────────────────────────────────────────────
export type { JwtPayload } from './jwt/JwtPayload.ts'
export { base64UrlEncode, base64UrlDecode, base64UrlEncodeString, base64UrlDecodeString } from './jwt/JwtEncoder.ts'
export { JwtSigner } from './jwt/JwtSigner.ts'

// ── Models ───────────────────────────────────────────────────────────────────
export { Client } from './models/Client.ts'
export { AccessToken } from './models/AccessToken.ts'
export { AuthCode } from './models/AuthCode.ts'
export { RefreshToken } from './models/RefreshToken.ts'

// ── Server ───────────────────────────────────────────────────────────────────
export { OAuthServer } from './OAuthServer.ts'
export type { OAuthConfig } from './OAuthServer.ts'

// ── Grants ───────────────────────────────────────────────────────────────────
export type { GrantHandler, OAuthTokenResponse } from './grants/GrantHandler.ts'
export { AuthCodeGrant } from './grants/AuthCodeGrant.ts'
export { ClientCredentialsGrant } from './grants/ClientCredentialsGrant.ts'
export { RefreshTokenGrant } from './grants/RefreshTokenGrant.ts'
export { PersonalAccessGrant } from './grants/PersonalAccessGrant.ts'

// ── Guards ───────────────────────────────────────────────────────────────────
export { JwtGuard } from './guards/JwtGuard.ts'

// ── Middleware ────────────────────────────────────────────────────────────────
export { CheckScopes } from './middleware/CheckScopes.ts'
export { CheckForAnyScope } from './middleware/CheckForAnyScope.ts'
export { CheckClientCredentials } from './middleware/CheckClientCredentials.ts'

// ── Routes ───────────────────────────────────────────────────────────────────
export { oauthRoutes } from './routes/oauthRoutes.ts'
export type { OAuthRouteOptions } from './routes/oauthRoutes.ts'
export { TokenController } from './routes/TokenController.ts'
export { AuthorizationController } from './routes/AuthorizationController.ts'
export { ClientController } from './routes/ClientController.ts'
export { ScopeController } from './routes/ScopeController.ts'

// ── Commands ─────────────────────────────────────────────────────────────────
export { OAuthInstallCommand } from './commands/OAuthInstallCommand.ts'
export { OAuthKeysCommand } from './commands/OAuthKeysCommand.ts'
export { OAuthClientCommand } from './commands/OAuthClientCommand.ts'
export { OAuthPurgeCommand } from './commands/OAuthPurgeCommand.ts'

// ── Migrations ───────────────────────────────────────────────────────────────
export { CreateOAuthClientsTable } from './migrations/CreateOAuthClientsTable.ts'
export { CreateOAuthAccessTokensTable } from './migrations/CreateOAuthAccessTokensTable.ts'
export { CreateOAuthAuthCodesTable } from './migrations/CreateOAuthAuthCodesTable.ts'
export { CreateOAuthRefreshTokensTable } from './migrations/CreateOAuthRefreshTokensTable.ts'

// ── Errors ───────────────────────────────────────────────────────────────────
export { OAuthError } from './errors/OAuthError.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────
export { oauth, OAUTH_SERVER } from './helpers/oauth.ts'

// ── Service Provider ─────────────────────────────────────────────────────────
export { OAuthServiceProvider } from './OAuthServiceProvider.ts'
