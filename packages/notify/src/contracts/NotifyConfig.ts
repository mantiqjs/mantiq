export interface SmsConfig {
  driver: 'twilio' | 'vonage'
  twilio?: { sid: string; token: string; from: string }
  vonage?: { apiKey: string; apiSecret: string; from: string }
}

export interface SlackConfig {
  webhookUrl?: string
  token?: string
}

export interface TelegramConfig {
  botToken: string
}

export interface WhatsAppConfig {
  accessToken: string
  phoneNumberId: string
}

export interface IMessageConfig {
  serviceUrl: string
  authToken: string
}

export interface RcsConfig {
  agentId: string
  accessToken: string
}

export interface FirebaseConfig {
  projectId: string
  accessToken?: string
  serviceAccountKey?: string
}

export interface NotifyConfig {
  channels?: {
    sms?: SmsConfig
    slack?: SlackConfig
    telegram?: TelegramConfig
    whatsapp?: WhatsAppConfig
    imessage?: IMessageConfig
    rcs?: RcsConfig
    firebase?: FirebaseConfig
  }
}

export const DEFAULT_CONFIG: NotifyConfig = {
  channels: {},
}
