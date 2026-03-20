export interface SmsConfig {
  driver: 'twilio' | 'vonage'
  twilio?: { sid: string; token: string; from: string }
  vonage?: { apiKey: string; apiSecret: string; from: string }
}

export interface SlackConfig {
  webhookUrl?: string
  token?: string
}

export interface NotifyConfig {
  channels?: {
    sms?: SmsConfig
    slack?: SlackConfig
  }
}

export const DEFAULT_CONFIG: NotifyConfig = {
  channels: {},
}
