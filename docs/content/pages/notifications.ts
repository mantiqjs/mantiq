export default {
  title: 'Notifications',
  content: `
<h2 id="introduction">Introduction</h2>
<p>The <code>@mantiq/notify</code> package provides a unified API for sending notifications across multiple delivery channels. Out of the box it supports mail, database, broadcast (SSE), SMS, Slack, Discord, Telegram, WhatsApp, Firebase push, webhook, iMessage, and RCS. The architecture is fully extensible &mdash; you can register custom channels with a single method call.</p>

<h2 id="configuration">Configuration</h2>
<p>Create a <code>config/notify.ts</code> file to configure channel-specific credentials. Channels that require no external credentials (mail, database, broadcast, webhook, Discord) are registered automatically. Channels that depend on third-party APIs are registered only when their configuration block is present:</p>

<pre><code class="language-typescript">export default {
  channels: {
    sms: {
      driver: 'twilio',
      twilio: {
        sid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        token: 'your-auth-token',
        from: '+15551234567',
      },
    },
    slack: {
      webhookUrl: 'https://hooks.slack.com/services/T00/B00/XXXX',
      // Or use API mode:
      // token: 'xoxb-your-bot-token',
    },
    telegram: {
      botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    },
    whatsapp: {
      accessToken: 'your-meta-access-token',
      phoneNumberId: '1234567890',
    },
    imessage: {
      serviceUrl: 'https://your-apple-business-endpoint.example.com',
      authToken: 'your-auth-token',
    },
    rcs: {
      agentId: 'your-rbm-agent-id',
      accessToken: 'your-google-access-token',
    },
    firebase: {
      projectId: 'your-firebase-project-id',
      serviceAccountKey: '/path/to/service-account.json',
      // Or use a static token:
      // accessToken: 'ya29.xxxxx',
    },
  },
}
</code></pre>

<p>You only need to configure the channels you actually use &mdash; unconfigured channels are never registered.</p>

<h2 id="registering-the-service-provider">Registering the Service Provider</h2>
<p>Register <code>NotificationServiceProvider</code> in your application bootstrap (<code>index.ts</code>):</p>

<pre><code class="language-typescript">import { NotificationServiceProvider } from '@mantiq/notify'

await app.registerProviders([
  CoreServiceProvider,
  NotificationServiceProvider,
  // ...other providers
])
await app.bootProviders()
</code></pre>

<p>The service provider reads the <code>notify</code> key from the config repository and registers a <code>NotificationManager</code> singleton in the container.</p>

<h2 id="creating-notifications">Creating Notifications</h2>
<p>Each notification is a class that extends the abstract <code>Notification</code> base class. The <code>via()</code> method declares which channels to deliver through, and <code>to{Channel}()</code> methods provide the payload for each channel:</p>

<pre><code class="language-typescript">import { Notification } from '@mantiq/notify'
import type { Notifiable } from '@mantiq/notify'
import { Mailable } from '@mantiq/mail'

class OrderShippedMail extends Mailable {
  constructor(private order: any) { super() }

  override build() {
    this.setSubject('Your order has shipped!')
    this.html(\`&lt;p&gt;Order #\${this.order.id} is on its way.&lt;/p&gt;\`)
  }
}

class OrderShipped extends Notification {
  constructor(private order: any) {
    super()
  }

  override via(notifiable: Notifiable): string[] {
    return ['mail', 'database']
  }

  toMail(notifiable: Notifiable): Mailable {
    return new OrderShippedMail(this.order)
  }

  toDatabase(notifiable: Notifiable): Record&lt;string, any&gt; {
    return {
      title: 'Order Shipped',
      orderId: this.order.id,
      message: \`Order #\${this.order.id} has been shipped.\`,
    }
  }
}
</code></pre>

<h3 id="notification-properties">Notification Properties</h3>
<p>Every notification instance has the following properties:</p>
<ul>
  <li><code>id</code> &mdash; A unique UUID generated automatically via <code>crypto.randomUUID()</code></li>
  <li><code>type</code> &mdash; The class name (e.g., <code>'OrderShipped'</code>), derived from <code>this.constructor.name</code></li>
  <li><code>shouldQueue</code> &mdash; Set to <code>true</code> to queue the notification instead of sending immediately (default: <code>false</code>)</li>
  <li><code>queue</code> &mdash; Optional queue name override</li>
  <li><code>connection</code> &mdash; Optional queue connection override</li>
  <li><code>tries</code> &mdash; Max retry attempts when queued (default: <code>3</code>)</li>
</ul>

<h3 id="payload-convention">The to{Channel}() Convention</h3>
<p>Channel routing follows a naming convention. A channel named <code>"foo"</code> calls <code>notification.toFoo(notifiable)</code>. The <code>getPayloadFor(channel, notifiable)</code> method capitalizes the first letter and looks up the method. If the method does not exist, the channel skips delivery silently.</p>

<p>Built-in optional method signatures:</p>
<ul>
  <li><code>toMail(notifiable): Mailable</code></li>
  <li><code>toDatabase(notifiable): Record&lt;string, any&gt;</code></li>
  <li><code>toBroadcast(notifiable): BroadcastPayload</code></li>
  <li><code>toSms(notifiable): SmsPayload</code></li>
  <li><code>toSlack(notifiable): SlackMessage</code></li>
  <li><code>toWebhook(notifiable): WebhookPayload</code></li>
</ul>

<p>For third-party channels (Discord, Telegram, WhatsApp, etc.), use the same convention: <code>toDiscord()</code>, <code>toTelegram()</code>, <code>toWhatsapp()</code>, <code>toImessage()</code>, <code>toRcs()</code>, <code>toFirebase()</code>.</p>

<h2 id="sending-notifications">Sending Notifications</h2>
<p>Use the <code>notify()</code> helper to access the <code>NotificationManager</code> and send notifications:</p>

<pre><code class="language-typescript">import { notify } from '@mantiq/notify'

// Send to a single notifiable
await notify().send(user, new OrderShipped(order))

// Send to multiple notifiables
await notify().send([user1, user2], new OrderShipped(order))

// Send immediately, bypassing the queue
await notify().sendNow(user, new OrderShipped(order))

// Send via specific channels (overrides via())
await notify().sendNow(user, new OrderShipped(order), ['mail'])
</code></pre>

<p>Channel errors are isolated &mdash; if Slack fails, the mail and database channels still fire. Failures are logged to <code>console.error</code>.</p>

<h2 id="channels">Channels</h2>

<h3 id="mail-channel">Mail Channel</h3>
<p>Delivers notifications via email using <code>@mantiq/mail</code>. The <code>toMail()</code> method must return a <code>Mailable</code> instance. If the mailable has no recipients set, the channel falls back to <code>notifiable.routeNotificationFor('mail')</code>:</p>

<pre><code class="language-typescript">class WelcomeMail extends Mailable {
  override build() {
    this.setSubject('Welcome!')
    this.html('&lt;h1&gt;Welcome aboard!&lt;/h1&gt;')
  }
}

// In your notification:
toMail(notifiable: Notifiable): Mailable {
  return new WelcomeMail()
}
</code></pre>

<p>Requires <code>@mantiq/mail</code> as a peer &mdash; throws <code>NotifyError</code> if missing.</p>

<h3 id="database-channel">Database Channel</h3>
<p>Persists notifications to the <code>notifications</code> table. The <code>toDatabase()</code> method returns a plain object that is JSON-stringified and stored in the <code>data</code> column:</p>

<pre><code class="language-typescript">toDatabase(notifiable: Notifiable): Record&lt;string, any&gt; {
  return {
    title: 'New Invoice',
    invoiceId: this.invoice.id,
    amount: this.invoice.total,
  }
}
</code></pre>

<p>The channel automatically sets <code>id</code>, <code>type</code>, <code>notifiable_type</code>, <code>notifiable_id</code>, and <code>read_at</code> (null) on the database record. The <code>notifiable_type</code> is resolved from <code>notifiable.getMorphClass()</code> or <code>notifiable.constructor.name</code>.</p>

<h3 id="broadcast-channel">Broadcast Channel</h3>
<p>Broadcasts notifications via SSE using <code>@mantiq/realtime</code>. The <code>toBroadcast()</code> method returns a <code>BroadcastPayload</code>:</p>

<pre><code class="language-typescript">interface BroadcastPayload {
  event: string
  data: any
  channel?: string   // defaults to App.User.{notifiable.getKey()}
}

toBroadcast(notifiable: Notifiable): BroadcastPayload {
  return {
    event: 'order.shipped',
    data: { orderId: this.order.id },
  }
}
</code></pre>

<p>If <code>@mantiq/realtime</code> is not installed, the broadcast channel skips silently without error.</p>

<h3 id="sms-channel">SMS Channel</h3>
<p>Sends SMS via Twilio or Vonage. The <code>toSms()</code> method returns an <code>SmsPayload</code>:</p>

<pre><code class="language-typescript">interface SmsPayload {
  to?: string    // falls back to notifiable.routeNotificationFor('sms')
  body: string
}

toSms(notifiable: Notifiable): SmsPayload {
  return {
    body: \`Your order #\${this.order.id} has shipped!\`,
  }
}
</code></pre>

<p>The driver is determined by the <code>channels.sms.driver</code> config value (<code>'twilio'</code> or <code>'vonage'</code>). Twilio sends form-encoded POST requests with Basic auth. Vonage sends JSON POST requests with API key/secret in the body.</p>

<h3 id="slack-channel">Slack Channel</h3>
<p>Sends notifications to Slack via webhook or the Slack Web API. The <code>toSlack()</code> method returns a <code>SlackMessage</code>:</p>

<pre><code class="language-typescript">interface SlackMessage {
  text?: string
  blocks?: any[]
  channel?: string
  username?: string
  iconEmoji?: string
  iconUrl?: string
}

toSlack(notifiable: Notifiable): SlackMessage {
  return {
    text: \`Order #\${this.order.id} shipped!\`,
    channel: '#orders',
  }
}
</code></pre>

<p>In <strong>webhook mode</strong> (<code>config.webhookUrl</code>), the message is POSTed directly to the webhook URL. In <strong>API mode</strong> (<code>config.token</code>), the message is sent via <code>chat.postMessage</code> with Bearer auth. The channel resolves from <code>payload.channel</code> or <code>notifiable.routeNotificationFor('slack')</code>.</p>

<h3 id="webhook-channel">Webhook Channel</h3>
<p>Delivers notifications via outgoing HTTP webhooks. The <code>toWebhook()</code> method returns a <code>WebhookPayload</code>:</p>

<pre><code class="language-typescript">interface WebhookPayload {
  url: string
  body: any
  method?: 'POST' | 'PUT' | 'PATCH'   // default: 'POST'
  headers?: Record&lt;string, string&gt;
}

toWebhook(notifiable: Notifiable): WebhookPayload {
  return {
    url: 'https://api.partner.com/webhooks/orders',
    body: { event: 'order.shipped', orderId: this.order.id },
    headers: { 'X-Webhook-Secret': 'my-secret' },
  }
}
</code></pre>

<h3 id="discord-channel">Discord Channel</h3>
<p>Sends notifications to Discord via webhook URL. The <code>toDiscord()</code> method returns a <code>DiscordPayload</code>:</p>

<pre><code class="language-typescript">interface DiscordPayload {
  webhookUrl: string
  content?: string
  embeds?: DiscordEmbed[]
  username?: string
  avatarUrl?: string
}

toDiscord(notifiable: Notifiable): DiscordPayload {
  return {
    webhookUrl: 'https://discord.com/api/webhooks/123/abc',
    content: \`Order #\${this.order.id} has shipped!\`,
    embeds: [{
      title: 'Order Shipped',
      description: 'Your order is on the way.',
      color: 0x00ff00,
      fields: [
        { name: 'Order ID', value: String(this.order.id), inline: true },
      ],
    }],
  }
}
</code></pre>

<h3 id="telegram-channel">Telegram Channel</h3>
<p>Sends notifications via the Telegram Bot API. The <code>toTelegram()</code> method returns a <code>TelegramPayload</code>:</p>

<pre><code class="language-typescript">interface TelegramPayload {
  chatId?: string | number   // falls back to notifiable.routeNotificationFor('telegram')
  text: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  replyMarkup?: any
}

toTelegram(notifiable: Notifiable): TelegramPayload {
  return {
    text: \`&lt;b&gt;Order Shipped&lt;/b&gt;\\nOrder #\${this.order.id} is on the way.\`,
    parseMode: 'HTML',
  }
}
</code></pre>

<p>Messages are sent via POST to <code>https://api.telegram.org/bot{botToken}/sendMessage</code>.</p>

<h3 id="whatsapp-channel">WhatsApp Channel</h3>
<p>Sends notifications via the Meta WhatsApp Cloud API. The <code>toWhatsapp()</code> method returns a <code>WhatsAppPayload</code>. You can send either a template message or a plain text message:</p>

<pre><code class="language-typescript">interface WhatsAppPayload {
  to?: string   // falls back to notifiable.routeNotificationFor('whatsapp')
  template?: {
    name: string
    languageCode: string
    components?: any[]
  }
  text?: string
}

// Template message
toWhatsapp(notifiable: Notifiable): WhatsAppPayload {
  return {
    template: {
      name: 'order_shipped',
      languageCode: 'en',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: this.order.id }] },
      ],
    },
  }
}

// Text message
toWhatsapp(notifiable: Notifiable): WhatsAppPayload {
  return {
    text: \`Your order #\${this.order.id} has shipped!\`,
  }
}
</code></pre>

<p>Messages are sent via POST to <code>https://graph.facebook.com/v21.0/{phoneNumberId}/messages</code> with Bearer auth.</p>

<h3 id="imessage-channel">iMessage Channel</h3>
<p>Sends notifications via Apple Messages for Business. The <code>toImessage()</code> method returns an <code>IMessagePayload</code>:</p>

<pre><code class="language-typescript">interface IMessagePayload {
  to?: string   // falls back to notifiable.routeNotificationFor('imessage')
  text: string
  interactiveData?: any
}

toImessage(notifiable: Notifiable): IMessagePayload {
  return {
    text: \`Your order #\${this.order.id} has shipped!\`,
  }
}
</code></pre>

<p>Messages are sent via POST to <code>{config.serviceUrl}/messages</code> with Bearer auth.</p>

<h3 id="rcs-channel">RCS Channel</h3>
<p>Sends notifications via Google RCS Business Messaging (RBM). The <code>toRcs()</code> method returns an <code>RcsPayload</code>. You can send either a text message or a rich card:</p>

<pre><code class="language-typescript">interface RcsPayload {
  to?: string   // falls back to notifiable.routeNotificationFor('rcs')
  text?: string
  richCard?: any
  suggestions?: any[]
}

toRcs(notifiable: Notifiable): RcsPayload {
  return {
    text: \`Order #\${this.order.id} shipped!\`,
    suggestions: [
      { reply: { text: 'Track Order', postbackData: 'track_order' } },
    ],
  }
}
</code></pre>

<p>If both <code>richCard</code> and <code>text</code> are provided, <code>richCard</code> takes precedence. Messages are sent to the Google RBM API at <code>https://rcsbusinessmessaging.googleapis.com/v1/phones/{phone}/agentMessages</code>.</p>

<h3 id="firebase-channel">Firebase Channel</h3>
<p>Sends push notifications via Firebase Cloud Messaging (FCM v1 API). The <code>toFirebase()</code> method returns a <code>FirebasePayload</code>:</p>

<pre><code class="language-typescript">interface FirebasePayload {
  token?: string   // falls back to notifiable.routeNotificationFor('firebase')
  topic?: string
  title: string
  body: string
  data?: Record&lt;string, string&gt;
  imageUrl?: string
}

toFirebase(notifiable: Notifiable): FirebasePayload {
  return {
    title: 'Order Shipped',
    body: \`Order #\${this.order.id} is on the way.\`,
    data: { orderId: String(this.order.id) },
  }
}
</code></pre>

<p>You can target by device token (<code>token</code> field or <code>routeNotificationFor('firebase')</code>) or by topic (<code>topic</code> field). Messages are sent to <code>https://fcm.googleapis.com/v1/projects/{projectId}/messages:send</code>.</p>

<p>Authenticate with either a static <code>accessToken</code> or a <code>serviceAccountKey</code> file path. Service account keys are exchanged for OAuth2 tokens via RS256 JWT assertion, cached automatically.</p>

<h2 id="notification-manager">NotificationManager</h2>
<p>The <code>NotificationManager</code> is the central hub that routes notifications through channels. It is registered as a singleton by the service provider and accessed via the <code>notify()</code> helper:</p>

<pre><code class="language-typescript">const manager = notify()

// Send a notification (respects shouldQueue)
await manager.send(user, new OrderShipped(order))

// Send immediately, bypassing the queue
await manager.sendNow(user, new OrderShipped(order))

// Send via specific channels only
await manager.sendNow(user, new OrderShipped(order), ['mail', 'slack'])
</code></pre>

<h3 id="channel-management">Channel Management</h3>

<pre><code class="language-typescript">// Check if a channel is registered
notify().hasChannel('mail')      // true
notify().hasChannel('sms')       // true (if configured)

// Get a channel instance
const mailChannel = notify().channel('mail')

// List all registered channel names
notify().channelNames()  // ['mail', 'database', 'broadcast', 'webhook', 'discord', ...]

// Register a custom channel (instance)
notify().extend('custom', new MyCustomChannel())

// Register a custom channel (lazy factory)
notify().extend('custom', () =&gt; new MyCustomChannel())
</code></pre>

<h3 id="built-in-channels">Built-in Channel Registration</h3>
<p>Channels are registered in two tiers:</p>

<p><strong>Zero-config channels</strong> (always available):</p>
<ul>
  <li><code>mail</code> &mdash; Email via <code>@mantiq/mail</code></li>
  <li><code>database</code> &mdash; Persists to the <code>notifications</code> table</li>
  <li><code>broadcast</code> &mdash; SSE via <code>@mantiq/realtime</code></li>
  <li><code>webhook</code> &mdash; Outgoing HTTP webhooks</li>
  <li><code>discord</code> &mdash; Discord via webhook URL</li>
</ul>

<p><strong>Config-based channels</strong> (registered only when their config block is present):</p>
<ul>
  <li><code>sms</code> &mdash; Twilio or Vonage</li>
  <li><code>slack</code> &mdash; Slack webhook or Web API</li>
  <li><code>telegram</code> &mdash; Telegram Bot API</li>
  <li><code>whatsapp</code> &mdash; Meta WhatsApp Cloud API</li>
  <li><code>imessage</code> &mdash; Apple Messages for Business</li>
  <li><code>rcs</code> &mdash; Google RCS Business Messaging</li>
  <li><code>firebase</code> &mdash; Firebase Cloud Messaging (FCM v1)</li>
</ul>

<h3 id="custom-channels">Custom Channels</h3>
<p>Implement the <code>NotificationChannel</code> interface and register with <code>extend()</code>:</p>

<pre><code class="language-typescript">import type { NotificationChannel, Notifiable } from '@mantiq/notify'
import { Notification } from '@mantiq/notify'

class PushoverChannel implements NotificationChannel {
  readonly name = 'pushover'

  async send(notifiable: Notifiable, notification: Notification): Promise&lt;void&gt; {
    const payload = notification.getPayloadFor('pushover', notifiable)
    if (!payload) return

    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }
}

// Register the channel
notify().extend('pushover', new PushoverChannel())
</code></pre>

<h2 id="notifiable-contract">The Notifiable Contract</h2>
<p>Any model that receives notifications must implement the <code>Notifiable</code> interface. The <code>routeNotificationFor()</code> method tells each channel where to deliver:</p>

<pre><code class="language-typescript">import { Model } from '@mantiq/database'
import type { Notifiable } from '@mantiq/notify'

class User extends Model implements Notifiable {
  static override table = 'users'
  static override fillable = ['name', 'email', 'phone']

  routeNotificationFor(channel: string): string | null {
    switch (channel) {
      case 'mail':      return this.get('email')
      case 'sms':       return this.get('phone')
      case 'whatsapp':  return this.get('phone')
      case 'slack':     return '#general'
      case 'telegram':  return this.get('telegram_chat_id')
      case 'firebase':  return this.get('fcm_token')
      case 'broadcast': return \`App.User.\${this.getKey()}\`
      default:          return null
    }
  }

  getKey(): any {
    return this.get('id')
  }

  getMorphClass(): string {
    return 'User'
  }
}
</code></pre>

<h2 id="queueing">Queueing Notifications</h2>
<p>Set <code>shouldQueue</code> to <code>true</code> on your notification to dispatch it through the queue instead of sending immediately:</p>

<pre><code class="language-typescript">class OrderShipped extends Notification {
  override shouldQueue = true
  override queue = 'notifications'    // optional queue name
  override connection = 'redis'       // optional connection
  override tries = 5                  // max retry attempts (default: 3)

  override via(notifiable: Notifiable): string[] {
    return ['mail', 'database', 'sms']
  }

  // ...channel methods
}
</code></pre>

<p>When <code>shouldQueue</code> is <code>true</code>, the manager dynamically imports <code>@mantiq/queue</code> and dispatches a <code>SendNotificationJob</code>. If <code>@mantiq/queue</code> is not installed, it falls back to <code>sendNow()</code>.</p>

<h2 id="database-notifications">Database Notifications</h2>

<h3 id="notifications-migration">Migration</h3>
<p>The package includes a migration to create the <code>notifications</code> table:</p>

<pre><code class="language-typescript">import { Migration, SchemaBuilder } from '@mantiq/database'

class CreateNotificationsTable extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('notifications', (t) =&gt; {
      t.string('id', 36).primary()
      t.string('type', 255)
      t.string('notifiable_type', 255)
      t.integer('notifiable_id').unsigned()
      t.text('data')
      t.timestamp('read_at').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('notifications')
  }
}
</code></pre>

<h3 id="database-notification-model">DatabaseNotification Model</h3>
<p>The <code>DatabaseNotification</code> model provides convenient accessors for reading and managing stored notifications:</p>

<pre><code class="language-typescript">import { DatabaseNotification } from '@mantiq/notify'

// Query notifications for a user
const notifications = await DatabaseNotification
  .query()
  .where('notifiable_type', 'User')
  .where('notifiable_id', userId)
  .orderBy('created_at', 'desc')
  .get()

// Check read status
notification.isRead     // true if read_at is not null
notification.isUnread   // true if read_at is null

// Mark as read / unread
await notification.markAsRead()
await notification.markAsUnread()
</code></pre>

<p>The model automatically casts the <code>data</code> column as JSON, so you can access notification data as a parsed object.</p>

<h2 id="events">Events</h2>
<p>The notification system dispatches three lifecycle events:</p>
<ul>
  <li><code>NotificationSending</code> &mdash; Fired before a notification is sent through a channel</li>
  <li><code>NotificationSent</code> &mdash; Fired after a notification is successfully sent</li>
  <li><code>NotificationFailed</code> &mdash; Fired when a channel fails to deliver (includes the error)</li>
</ul>

<pre><code class="language-typescript">import { NotificationSending, NotificationSent, NotificationFailed } from '@mantiq/notify'

// Each event carries:
//   notifiable:   the recipient
//   notification: the notification instance
//   channel:      the channel name (e.g., 'mail', 'sms')

// NotificationFailed also carries:
//   error:        the Error that occurred
</code></pre>

<h2 id="helpers">Helpers</h2>

<h3 id="notify-helper">notify()</h3>
<p>The <code>notify()</code> helper retrieves the <code>NotificationManager</code> singleton from the application container:</p>

<pre><code class="language-typescript">import { notify } from '@mantiq/notify'

await notify().send(user, new OrderShipped(order))
await notify().send([user1, user2], new WelcomeNotification())
</code></pre>

<h3 id="make-notification-command">make:notification Command</h3>
<p>Scaffold a new notification class with the CLI:</p>

<pre><code class="language-typescript">bun mantiq make:notification OrderShipped
</code></pre>

<p>This generates <code>app/Notifications/OrderShipped.ts</code> with <code>via()</code> returning <code>['mail', 'database']</code>, a <code>toMail()</code> stub, and a <code>toDatabase()</code> stub.</p>

<h2 id="testing">Testing with NotificationFake</h2>
<p>The <code>NotificationFake</code> class records sent notifications in memory without delivering them. Use it to assert that your application sends the right notifications:</p>

<pre><code class="language-typescript">import { NotificationFake } from '@mantiq/notify'

const fake = new NotificationFake()

// Send notifications through the fake
await fake.send(user, new OrderShipped(order))

// Assert a notification was sent to a specific notifiable
fake.assertSentTo(user, OrderShipped)

// Assert with an exact count
fake.assertSentTo(user, OrderShipped, 1)

// Assert a notification was NOT sent
fake.assertNotSentTo(user, WelcomeNotification)

// Assert a notification was sent (to anyone)
fake.assertSent(OrderShipped)

// Assert a specific count
fake.assertCount(OrderShipped, 1)

// Assert nothing was sent
fake.assertNothingSent()

// Assert a notification was sent via a specific channel
fake.assertSentToVia(user, OrderShipped, 'mail')
fake.assertSentToVia(user, OrderShipped, 'database')
</code></pre>

<h3 id="inspection-methods">Inspection Methods</h3>

<pre><code class="language-typescript">// Get all sent records
const records = fake.sent()
// Each record: { notifiable, notification, channels }

// Get records filtered by notifiable
const userRecords = fake.sentTo(user)

// Clear all recorded notifications
fake.reset()
</code></pre>

<h3 id="full-test-example">Full Test Example</h3>

<pre><code class="language-typescript">import { describe, it, expect, beforeEach } from 'bun:test'
import { NotificationFake } from '@mantiq/notify'

describe('OrderController', () =&gt; {
  let fake: NotificationFake

  beforeEach(() =&gt; {
    fake = new NotificationFake()
  })

  it('sends an order shipped notification', async () =&gt; {
    const user = createUser()
    const order = createOrder()

    // Replace notify() with the fake in your test setup
    await fake.send(user, new OrderShipped(order))

    fake.assertSentTo(user, OrderShipped, 1)
    fake.assertSentToVia(user, OrderShipped, 'mail')
    fake.assertSentToVia(user, OrderShipped, 'database')
  })

  it('does not send to unrelated users', async () =&gt; {
    const user = createUser()
    const otherUser = createUser()
    const order = createOrder()

    await fake.send(user, new OrderShipped(order))

    fake.assertNotSentTo(otherUser, OrderShipped)
  })
})
</code></pre>
`
}
