import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Third-Party Services
  |--------------------------------------------------------------------------
  |
  | Centralized credentials for external services used by your application.
  | Other config files (mail, notify, filesystem, search) reference these
  | same env vars, but this file gives you a single place to see all
  | third-party integrations at a glance.
  |
  */

  /*
  |--------------------------------------------------------------------------
  | AWS (S3, SES, etc.)
  |--------------------------------------------------------------------------
  */
  aws: {
    accessKeyId: env('AWS_ACCESS_KEY_ID', ''),
    secretAccessKey: env('AWS_SECRET_ACCESS_KEY', ''),
    region: env('AWS_REGION', 'us-east-1'),
    bucket: env('AWS_BUCKET', ''),
  },

  /*
  |--------------------------------------------------------------------------
  | Stripe
  |--------------------------------------------------------------------------
  */
  stripe: {
    key: env('STRIPE_KEY', ''),
    secret: env('STRIPE_SECRET', ''),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET', ''),
  },

  /*
  |--------------------------------------------------------------------------
  | Resend
  |--------------------------------------------------------------------------
  */
  resend: {
    apiKey: env('RESEND_API_KEY', ''),
  },

  /*
  |--------------------------------------------------------------------------
  | Slack
  |--------------------------------------------------------------------------
  */
  slack: {
    webhookUrl: env('SLACK_WEBHOOK_URL', ''),
    botToken: env('SLACK_BOT_TOKEN', ''),
  },

  /*
  |--------------------------------------------------------------------------
  | Twilio (SMS)
  |--------------------------------------------------------------------------
  */
  twilio: {
    sid: env('TWILIO_SID', ''),
    token: env('TWILIO_TOKEN', ''),
    from: env('TWILIO_FROM', ''),
  },

  /*
  |--------------------------------------------------------------------------
  | Telegram
  |--------------------------------------------------------------------------
  */
  telegram: {
    botToken: env('TELEGRAM_BOT_TOKEN', ''),
  },

  /*
  |--------------------------------------------------------------------------
  | Firebase
  |--------------------------------------------------------------------------
  */
  firebase: {
    projectId: env('FIREBASE_PROJECT_ID', ''),
    serviceAccountKey: env('FIREBASE_SERVICE_ACCOUNT_KEY', ''),
  },

  /*
  |--------------------------------------------------------------------------
  | Algolia
  |--------------------------------------------------------------------------
  */
  algolia: {
    applicationId: env('ALGOLIA_APP_ID', ''),
    apiKey: env('ALGOLIA_SECRET', ''),
  },

  /*
  |--------------------------------------------------------------------------
  | Redis
  |--------------------------------------------------------------------------
  */
  redis: {
    url: env('REDIS_URL', ''),
    host: env('REDIS_HOST', '127.0.0.1'),
    port: Number(env('REDIS_PORT', '6379')),
    password: env('REDIS_PASSWORD', ''),
  },
}
