import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

export interface FirebaseConfig {
  projectId: string
  accessToken?: string | undefined
  serviceAccountKey?: string | undefined
}

export interface FirebasePayload {
  token?: string | undefined
  topic?: string | undefined
  title: string
  body: string
  data?: Record<string, string> | undefined
  imageUrl?: string | undefined
}

/**
 * Sends push notifications via Firebase Cloud Messaging (FCM) v1 API.
 *
 * The notification's `toFirebase(notifiable)` method should return a `FirebasePayload`
 * with at minimum `title` and `body`. Target is resolved from `token`, `topic`, or
 * `notifiable.routeNotificationFor('firebase')` (for the device FCM token).
 *
 * Two authentication modes:
 *   1. **Access Token** — provide `accessToken` directly in config
 *   2. **Service Account Key** — provide `serviceAccountKey` JSON string; the channel
 *      will mint an OAuth2 token via Google's token endpoint using JWT assertion
 *
 * Uses native `fetch()` — no Firebase Admin SDK required.
 */
export class FirebaseChannel implements NotificationChannel {
  readonly name = 'firebase'

  private cachedAccessToken: string | undefined
  private tokenExpiresAt = 0

  constructor(private readonly config: FirebaseConfig) {}

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('firebase', notifiable) as FirebasePayload | undefined
    if (!payload) return

    // Resolve target: payload.token > payload.topic > notifiable route
    const token = payload.token ?? notifiable.routeNotificationFor('firebase')
    const topic = payload.topic

    if (!token && !topic) {
      throw new NotifyError('No FCM target: payload.token and payload.topic are empty and notifiable returned null for firebase route', {
        channel: this.name,
        notificationType: notification.type,
      })
    }

    const accessToken = await this.resolveAccessToken()

    const message: Record<string, any> = {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
    }

    if (token) {
      message.token = token
    } else if (topic) {
      message.topic = topic
    }

    if (payload.data) {
      message.data = payload.data
    }

    const url = `https://fcm.googleapis.com/v1/projects/${this.config.projectId}/messages:send`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`FCM API error (${response.status}): ${errorBody}`, {
        channel: this.name,
        notificationType: notification.type,
        statusCode: response.status,
      })
    }
  }

  /**
   * Resolve the OAuth2 access token for FCM API calls.
   * If a static `accessToken` was provided, use it directly.
   * Otherwise, mint a token from the service account key via JWT assertion.
   */
  private async resolveAccessToken(): Promise<string> {
    if (this.config.accessToken) {
      return this.config.accessToken
    }

    // Return cached token if still valid (with 60s safety margin)
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.cachedAccessToken
    }

    if (!this.config.serviceAccountKey) {
      throw new NotifyError('Firebase configuration requires either accessToken or serviceAccountKey', {
        channel: this.name,
      })
    }

    let serviceAccount: {
      client_email: string
      private_key: string
      token_uri?: string
    }

    try {
      serviceAccount = JSON.parse(this.config.serviceAccountKey)
    } catch {
      throw new NotifyError('Firebase serviceAccountKey is not valid JSON', {
        channel: this.name,
      })
    }

    const tokenUri = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token'
    const now = Math.floor(Date.now() / 1000)
    const expiry = now + 3600

    const jwt = await this.createJwt(
      {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: tokenUri,
        iat: now,
        exp: expiry,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
      },
      serviceAccount.private_key,
    )

    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error')
      throw new NotifyError(`Failed to obtain FCM access token (${response.status}): ${errorBody}`, {
        channel: this.name,
        statusCode: response.status,
      })
    }

    const result = (await response.json()) as any
    this.cachedAccessToken = result.access_token
    this.tokenExpiresAt = Date.now() + (result.expires_in ?? 3600) * 1000

    return this.cachedAccessToken!
  }

  /**
   * Create a signed JWT using the Web Crypto API (RS256).
   * Parses a PEM-encoded RSA private key and signs with RSASSA-PKCS1-v1_5.
   */
  private async createJwt(claims: Record<string, any>, privateKeyPem: string): Promise<string> {
    const header = { alg: 'RS256', typ: 'JWT' }

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header))
    const encodedClaims = this.base64UrlEncode(JSON.stringify(claims))
    const signingInput = `${encodedHeader}.${encodedClaims}`

    // Import the PEM private key
    const keyData = this.pemToArrayBuffer(privateKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    // Sign
    const signatureBuffer = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput),
    )

    const encodedSignature = this.base64UrlEncodeBuffer(new Uint8Array(signatureBuffer))

    return `${signingInput}.${encodedSignature}`
  }

  /** Convert a PEM-encoded key to an ArrayBuffer */
  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const base64 = pem
      .replace(/-----BEGIN [A-Z ]+-----/g, '')
      .replace(/-----END [A-Z ]+-----/g, '')
      .replace(/\s/g, '')

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /** Base64url-encode a UTF-8 string */
  private base64UrlEncode(str: string): string {
    const base64 = btoa(str)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  /** Base64url-encode a Uint8Array */
  private base64UrlEncodeBuffer(buffer: Uint8Array): string {
    let binary = ''
    for (const byte of buffer) {
      binary += String.fromCharCode(byte)
    }
    const base64 = btoa(binary)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
}
