export interface SmsConfig {
  driver: 'twilio' | 'vonage'
  twilio?: { sid: string; token: string; from: string } | undefined
  vonage?: { apiKey: string; apiSecret: string; from: string } | undefined
}

export interface SlackConfig {
  webhookUrl?: string | undefined
  token?: string | undefined
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
  accessToken?: string | undefined
  serviceAccountKey?: string | undefined
}

export interface NotifyConfig {
  channels?: {
    sms?: SmsConfig | undefined
    slack?: SlackConfig | undefined
    telegram?: TelegramConfig | undefined
    whatsapp?: WhatsAppConfig | undefined
    imessage?: IMessageConfig | undefined
    rcs?: RcsConfig | undefined
    firebase?: FirebaseConfig | undefined
  } | undefined
}

export const DEFAULT_CONFIG: NotifyConfig = {
  channels: {},
}
