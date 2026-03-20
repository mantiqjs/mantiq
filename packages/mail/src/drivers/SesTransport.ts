import type { MailTransport } from '../contracts/Transport.ts'
import { Message } from '../Message.ts'
import { MailError } from '../errors/MailError.ts'

export interface SesConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export class SesTransport implements MailTransport {
  private config: SesConfig

  constructor(config: SesConfig) {
    this.config = config
  }

  async send(message: Message): Promise<{ id: string }> {
    const { region, accessKeyId, secretAccessKey } = this.config
    const host = `email.${region}.amazonaws.com`
    const url = `https://${host}/v2/email/outbound-emails`

    const destination: Record<string, string[]> = {
      ToAddresses: message.to.map((addr) => Message.formatAddress(addr)),
    }

    if (message.cc.length > 0) {
      destination.CcAddresses = message.cc.map((addr) => Message.formatAddress(addr))
    }

    if (message.bcc.length > 0) {
      destination.BccAddresses = message.bcc.map((addr) => Message.formatAddress(addr))
    }

    const bodyContent: Record<string, { Data: string; Charset: string }> = {}

    if (message.html !== null) {
      bodyContent.Html = { Data: message.html, Charset: 'UTF-8' }
    }

    if (message.text !== null) {
      bodyContent.Text = { Data: message.text, Charset: 'UTF-8' }
    }

    const body: Record<string, any> = {
      FromEmailAddress: Message.formatAddress(message.from),
      Destination: destination,
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: bodyContent,
        },
      },
    }

    if (message.replyTo.length > 0) {
      body.ReplyToAddresses = message.replyTo.map((addr) => Message.formatAddress(addr))
    }

    if (Object.keys(message.headers).length > 0) {
      body.EmailTags = Object.entries(message.headers).map(([Name, Value]) => ({
        Name,
        Value,
      }))
    }

    const payload = JSON.stringify(body)
    const now = new Date()

    // AWS Signature V4
    const dateStamp = this.toDateStamp(now)
    const amzDate = this.toAmzDate(now)
    const service = 'ses'
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`

    const canonicalHeaders =
      `content-type:application/json\n` +
      `host:${host}\n` +
      `x-amz-date:${amzDate}\n`

    const signedHeaders = 'content-type;host;x-amz-date'

    const payloadHash = await this.sha256Hex(payload)

    const canonicalRequest = [
      'POST',
      '/v2/email/outbound-emails',
      '', // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    const canonicalRequestHash = await this.sha256Hex(canonicalRequest)

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join('\n')

    // Derive signing key
    const kDate = await this.hmacSha256(
      new TextEncoder().encode(`AWS4${secretAccessKey}`),
      dateStamp,
    )
    const kRegion = await this.hmacSha256(kDate, region)
    const kService = await this.hmacSha256(kRegion, service)
    const kSigning = await this.hmacSha256(kService, 'aws4_request')

    const signature = await this.hmacSha256Hex(kSigning, stringToSign)

    const authorizationHeader =
      `AWS4-HMAC-SHA256 ` +
      `Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Authorization': authorizationHeader,
      },
      body: payload,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new MailError(`AWS SES API error: ${response.status} ${response.statusText}`, {
        status: response.status,
        body: errorBody,
      })
    }

    const result = await response.json() as { MessageId: string }

    return { id: result.MessageId }
  }

  private toDateStamp(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '')
  }

  private toAmzDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  private async sha256Hex(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return this.bufferToHex(hashBuffer)
  }

  private async hmacSha256(key: Uint8Array | ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const keyBuffer = key instanceof ArrayBuffer ? key : (key as Uint8Array).buffer as ArrayBuffer
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
  }

  private async hmacSha256Hex(key: Uint8Array | ArrayBuffer, data: string): Promise<string> {
    const result = await this.hmacSha256(key, data)
    return this.bufferToHex(result)
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let hex = ''
    for (let i = 0; i < bytes.length; i++) {
      hex += (bytes[i] as number).toString(16).padStart(2, '0')
    }
    return hex
  }
}
