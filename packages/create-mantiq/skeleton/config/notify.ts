export default {

  /*
  |--------------------------------------------------------------------------
  | Notification Channels
  |--------------------------------------------------------------------------
  |
  | Define custom notification channels for your application. Built-in
  | channels include mail, database, broadcast, SMS, Slack, and webhook.
  |
  | Each channel maps to a driver that handles delivery. Add channels
  | as your application needs grow.
  |
  | Example:
  |
  |   slack: {
  |     driver: 'slack',
  |     webhookUrl: env('SLACK_WEBHOOK_URL', ''),
  |   },
  |   sms: {
  |     driver: 'twilio',
  |     sid: env('TWILIO_SID', ''),
  |     token: env('TWILIO_TOKEN', ''),
  |     from: env('TWILIO_FROM', ''),
  |   },
  |
  */
  channels: {},
}
