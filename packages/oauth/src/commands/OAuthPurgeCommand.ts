import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { AccessToken } from '../models/AccessToken.ts'
import { RefreshToken } from '../models/RefreshToken.ts'
import { AuthCode } from '../models/AuthCode.ts'

/**
 * Purge expired and revoked OAuth tokens.
 *
 * Usage: mantiq oauth:purge [--revoked]
 */
export class OAuthPurgeCommand extends Command {
  override name = 'oauth:purge'
  override description = 'Purge revoked and/or expired tokens and auth codes'
  override usage = 'oauth:purge [--revoked]'

  override async handle(args: ParsedArgs): Promise<number> {
    const revokedOnly = !!args.flags['revoked']

    this.io.info('Purging OAuth tokens...')

    const now = new Date().toISOString()
    let purgedTokens = 0
    let purgedRefresh = 0
    let purgedCodes = 0

    if (revokedOnly) {
      // Only purge revoked tokens
      const revokedAccessTokens = await AccessToken.where('revoked', true).get()
      for (const token of revokedAccessTokens) {
        await token.delete()
        purgedTokens++
      }

      const revokedRefreshTokens = await RefreshToken.where('revoked', true).get()
      for (const token of revokedRefreshTokens) {
        await token.delete()
        purgedRefresh++
      }

      const revokedAuthCodes = await AuthCode.where('revoked', true).get()
      for (const code of revokedAuthCodes) {
        await code.delete()
        purgedCodes++
      }
    } else {
      // Purge expired + revoked
      const expiredAccessTokens = await AccessToken.where('expires_at', '<', now).get()
      const revokedAccessTokens = await AccessToken.where('revoked', true).get()
      const allAccessTokens = new Map<string, typeof expiredAccessTokens[0]>()
      for (const t of [...expiredAccessTokens, ...revokedAccessTokens]) {
        allAccessTokens.set(t.getKey() as string, t)
      }
      for (const token of allAccessTokens.values()) {
        await token.delete()
        purgedTokens++
      }

      const expiredRefreshTokens = await RefreshToken.where('expires_at', '<', now).get()
      const revokedRefreshTokens = await RefreshToken.where('revoked', true).get()
      const allRefreshTokens = new Map<string, typeof expiredRefreshTokens[0]>()
      for (const t of [...expiredRefreshTokens, ...revokedRefreshTokens]) {
        allRefreshTokens.set(t.getKey() as string, t)
      }
      for (const token of allRefreshTokens.values()) {
        await token.delete()
        purgedRefresh++
      }

      const expiredAuthCodes = await AuthCode.where('expires_at', '<', now).get()
      const revokedAuthCodes = await AuthCode.where('revoked', true).get()
      const allAuthCodes = new Map<string, typeof expiredAuthCodes[0]>()
      for (const c of [...expiredAuthCodes, ...revokedAuthCodes]) {
        allAuthCodes.set(c.getKey() as string, c)
      }
      for (const code of allAuthCodes.values()) {
        await code.delete()
        purgedCodes++
      }
    }

    this.io.success('Purge complete.')
    this.io.twoColumn('Access tokens purged:', String(purgedTokens))
    this.io.twoColumn('Refresh tokens purged:', String(purgedRefresh))
    this.io.twoColumn('Auth codes purged:', String(purgedCodes))

    return 0
  }
}
