// import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Notification Channels
  |--------------------------------------------------------------------------
  |
  | Configure notification delivery channels. Built-in channels:
  | mail, database, broadcast, slack, sms, telegram, discord, webhook,
  | whatsapp, firebase, imessage, rcs
  |
  | "mail", "database", and "broadcast" work out of the box with no
  | additional config. The channels below require external credentials.
  |
  */
  channels: {

    /*
    |----------------------------------------------------------------------
    | Slack
    |----------------------------------------------------------------------
    |
    | Send notifications to Slack via webhook URL or Bot API token.
    | Webhook: paste the Incoming Webhook URL from Slack.
    | Bot: create a Slack App and use the Bot User OAuth Token.
    |
    */
    // slack: {
    //   webhookUrl: env('SLACK_WEBHOOK_URL', ''),
    //   token: env('SLACK_BOT_TOKEN', ''),
    // },

    /*
    |----------------------------------------------------------------------
    | SMS (Twilio / Vonage)
    |----------------------------------------------------------------------
    |
    | Send SMS notifications via Twilio or Vonage (Nexmo).
    |
    | Supported drivers: 'twilio', 'vonage'
    |
    */
    // sms: {
    //   driver: 'twilio' as const,
    //   twilio: {
    //     sid: env('TWILIO_SID', ''),
    //     token: env('TWILIO_TOKEN', ''),
    //     from: env('TWILIO_FROM', ''),
    //   },
    //   // vonage: {
    //   //   apiKey: env('VONAGE_API_KEY', ''),
    //   //   apiSecret: env('VONAGE_API_SECRET', ''),
    //   //   from: env('VONAGE_FROM', ''),
    //   // },
    // },

    /*
    |----------------------------------------------------------------------
    | Telegram
    |----------------------------------------------------------------------
    |
    | Send notifications via Telegram Bot API.
    | Create a bot with @BotFather and paste the token here.
    |
    */
    // telegram: {
    //   botToken: env('TELEGRAM_BOT_TOKEN', ''),
    // },

    /*
    |----------------------------------------------------------------------
    | Discord
    |----------------------------------------------------------------------
    |
    | Send notifications to Discord channels via webhook URL.
    | Create a webhook in Channel Settings → Integrations → Webhooks.
    |
    | Note: Discord webhookUrl is set per-notification, not globally.
    |
    */

    /*
    |----------------------------------------------------------------------
    | WhatsApp (Meta Business API)
    |----------------------------------------------------------------------
    |
    | Send WhatsApp messages via the Meta Business Platform API.
    | Requires a verified WhatsApp Business Account.
    |
    */
    // whatsapp: {
    //   accessToken: env('WHATSAPP_ACCESS_TOKEN', ''),
    //   phoneNumberId: env('WHATSAPP_PHONE_NUMBER_ID', ''),
    // },

    /*
    |----------------------------------------------------------------------
    | Firebase Cloud Messaging (FCM)
    |----------------------------------------------------------------------
    |
    | Send push notifications to mobile and web apps via Firebase.
    | Provide either a static accessToken or a serviceAccountKey JSON
    | string for automatic token generation.
    |
    */
    // firebase: {
    //   projectId: env('FIREBASE_PROJECT_ID', ''),
    //   serviceAccountKey: env('FIREBASE_SERVICE_ACCOUNT_KEY', ''),
    // },

    /*
    |----------------------------------------------------------------------
    | Apple iMessage (Business Chat)
    |----------------------------------------------------------------------
    |
    | Send iMessage notifications via Apple Business Chat service.
    | Requires an Apple Business Chat account and service endpoint.
    |
    */
    // imessage: {
    //   serviceUrl: env('IMESSAGE_SERVICE_URL', ''),
    //   authToken: env('IMESSAGE_AUTH_TOKEN', ''),
    // },

    /*
    |----------------------------------------------------------------------
    | RCS (Rich Communication Services)
    |----------------------------------------------------------------------
    |
    | Send rich messages via RCS Business Messaging API.
    | Supports rich cards, carousels, and suggested actions.
    |
    */
    // rcs: {
    //   agentId: env('RCS_AGENT_ID', ''),
    //   accessToken: env('RCS_ACCESS_TOKEN', ''),
    // },
  },
}
