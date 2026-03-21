// ── Contracts ────────────────────────────────────────────────────────────────
export type { OAuthProvider } from './contracts/OAuthProvider.ts'
export type { OAuthUser } from './contracts/OAuthUser.ts'

// ── Abstract base ────────────────────────────────────────────────────────────
export { AbstractProvider } from './AbstractProvider.ts'
export type { ProviderConfig } from './AbstractProvider.ts'

// ── Built-in providers ───────────────────────────────────────────────────────
export { GoogleProvider } from './providers/GoogleProvider.ts'
export { GitHubProvider } from './providers/GitHubProvider.ts'
export { FacebookProvider } from './providers/FacebookProvider.ts'
export { AppleProvider } from './providers/AppleProvider.ts'
export { TwitterProvider } from './providers/TwitterProvider.ts'
export { LinkedInProvider } from './providers/LinkedInProvider.ts'
export { MicrosoftProvider } from './providers/MicrosoftProvider.ts'
export { DiscordProvider } from './providers/DiscordProvider.ts'

// ── Manager ──────────────────────────────────────────────────────────────────
export { SocialAuthManager } from './SocialAuthManager.ts'
export type { SocialAuthConfig } from './SocialAuthManager.ts'

// ── Service provider ─────────────────────────────────────────────────────────
export { SocialAuthServiceProvider } from './SocialAuthServiceProvider.ts'

// ── Global helper ────────────────────────────────────────────────────────────
export { socialAuth, setSocialAuthManager } from './helpers/social-auth.ts'
