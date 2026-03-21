export default {
  title: 'Logging',
  content: `
<h2 id="introduction">Introduction</h2>
<p>The <code>@mantiq/logging</code> package provides a channel-based logging system with log level filtering, formatters, multi-driver dispatch, daily file rotation, and testing fakes. It follows a driver-managed architecture, allowing you to send log messages to multiple destinations simultaneously &mdash; the console, a single file, daily rotating files, or any combination via a stack channel.</p>

<p>Log levels follow the <strong>RFC 5424</strong> severity ordering. Lower numeric values are more severe:</p>

<table>
  <thead><tr><th>Level</th><th>Severity</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>emergency</code></td><td>0</td><td>System is unusable</td></tr>
    <tr><td><code>alert</code></td><td>1</td><td>Action must be taken immediately</td></tr>
    <tr><td><code>critical</code></td><td>2</td><td>Critical conditions</td></tr>
    <tr><td><code>error</code></td><td>3</td><td>Error conditions</td></tr>
    <tr><td><code>warning</code></td><td>4</td><td>Warning conditions</td></tr>
    <tr><td><code>notice</code></td><td>5</td><td>Normal but significant conditions</td></tr>
    <tr><td><code>info</code></td><td>6</td><td>Informational messages</td></tr>
    <tr><td><code>debug</code></td><td>7</td><td>Debug-level messages</td></tr>
  </tbody>
</table>

<p>A driver configured with a minimum level will only log entries whose numeric severity is less than or equal to the minimum level&rsquo;s numeric value. For example, a channel with level <code>warning</code> (4) will log <code>emergency</code> through <code>warning</code>, but ignore <code>notice</code>, <code>info</code>, and <code>debug</code>.</p>

<h2 id="configuration">Configuration</h2>
<p>Logging is configured in <code>config/logging.ts</code>. This file defines the default channel and all available channels:</p>

<pre><code class="language-typescript">// config/logging.ts
export default {
  default: 'stack',

  channels: {
    stack: {
      driver: 'stack',
      channels: ['console', 'daily'],
    },

    console: {
      driver: 'console',
      level: 'debug',
    },

    daily: {
      driver: 'daily',
      path: 'storage/logs/mantiq.log',
      level: 'debug',
      days: 14,
    },

    file: {
      driver: 'file',
      path: 'storage/logs/mantiq.log',
      level: 'debug',
    },

    null: {
      driver: 'null',
    },
  },
}
</code></pre>

<p>Relative log paths (those not starting with <code>/</code>) are automatically resolved to absolute paths by the <code>LoggingServiceProvider</code> using your application&rsquo;s base path.</p>

<h3 id="channel-config-options">Channel Config Options</h3>
<p>Each channel entry supports the following options:</p>

<table>
  <thead><tr><th>Option</th><th>Type</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>driver</code></td><td><code>string</code></td><td>The driver to use: <code>console</code>, <code>file</code>, <code>daily</code>, <code>stack</code>, or <code>null</code></td></tr>
    <tr><td><code>level</code></td><td><code>LogLevel</code></td><td>Minimum log level. Messages below this severity are discarded.</td></tr>
    <tr><td><code>formatter</code></td><td><code>'line' | 'json'</code></td><td>Which formatter to use. Defaults to <code>line</code> if not specified.</td></tr>
    <tr><td><code>path</code></td><td><code>string</code></td><td>File path for <code>file</code> and <code>daily</code> drivers. Defaults to <code>storage/logs/mantiq.log</code>.</td></tr>
    <tr><td><code>days</code></td><td><code>number</code></td><td>Number of days to retain daily log files. Defaults to <code>14</code>. Only used by the <code>daily</code> driver.</td></tr>
    <tr><td><code>channels</code></td><td><code>string[]</code></td><td>List of channel names to fan out to. Only used by the <code>stack</code> driver.</td></tr>
  </tbody>
</table>

<h2 id="channels">Channels</h2>
<p>MantiqJS ships with five built-in logging channels (drivers). Each implements the <code>LoggerDriver</code> interface.</p>

<h3 id="console-channel">Console</h3>
<p>Writes formatted log lines to <code>process.stdout</code> or <code>process.stderr</code>:</p>
<ul>
  <li><strong>stderr</strong> for levels with numeric severity &lt;= <code>error</code> (i.e., <code>emergency</code>, <code>alert</code>, <code>critical</code>, <code>error</code>)</li>
  <li><strong>stdout</strong> for all other levels (<code>warning</code>, <code>notice</code>, <code>info</code>, <code>debug</code>)</li>
</ul>

<pre><code class="language-typescript">// config/logging.ts
channels: {
  console: {
    driver: 'console',
    level: 'debug',
    formatter: 'line',  // or 'json'
  },
}
</code></pre>

<p>The console channel can be resolved even without explicit configuration. If no channel config exists for <code>console</code>, the <code>LogManager</code> creates a <code>ConsoleDriver</code> with <code>debug</code> level by default.</p>

<h3 id="file-channel">File</h3>
<p>Appends formatted log lines to a single file at the configured path. Parent directories are created lazily on first write. File I/O is fire-and-forget, so logging never blocks the request.</p>

<pre><code class="language-typescript">channels: {
  file: {
    driver: 'file',
    path: 'storage/logs/mantiq.log',
    level: 'debug',
  },
}
</code></pre>

<h3 id="daily-channel">Daily</h3>
<p>Writes to date-stamped log files with automatic rotation. Given a base path of <code>storage/logs/mantiq.log</code>, today&rsquo;s file becomes <code>storage/logs/mantiq-2024-03-19.log</code>.</p>

<pre><code class="language-typescript">channels: {
  daily: {
    driver: 'daily',
    path: 'storage/logs/mantiq.log',
    level: 'debug',
    days: 14,  // retain log files for 14 days
  },
}
</code></pre>

<p>On the first write of each run, the daily driver performs a best-effort background prune that deletes log files older than the configured <code>days</code> threshold.</p>

<h3 id="stack-channel">Stack</h3>
<p>Fans out every log call to multiple underlying channels. This is useful when you want to write to both the console and a file simultaneously:</p>

<pre><code class="language-typescript">channels: {
  stack: {
    driver: 'stack',
    channels: ['console', 'daily'],
  },
}
</code></pre>

<p>The stack driver recursively resolves each channel listed in its <code>channels</code> array, so you can combine any drivers.</p>

<h3 id="null-channel">Null</h3>
<p>Silently discards all log entries. Useful when you want to disable logging entirely:</p>

<pre><code class="language-typescript">channels: {
  null: {
    driver: 'null',
  },
}
</code></pre>

<h2 id="formatters">Formatters</h2>
<p>Formatters transform a <code>LogEntry</code> into a string for output. Two formatters are included out of the box.</p>

<h3 id="line-formatter">LineFormatter</h3>
<p>Produces a human-readable single-line format. This is the default formatter when none is specified:</p>

<pre><code class="language-typescript">[2024-06-15T10:30:00.000Z] app.INFO      User logged in {"userId":42}
</code></pre>

<ul>
  <li>Timestamp in ISO 8601 format</li>
  <li>Channel name and level (uppercased, right-padded to 9 characters)</li>
  <li>Context serialized as JSON after the message &mdash; omitted entirely when the context object has no keys</li>
</ul>

<h3 id="json-formatter">JsonFormatter</h3>
<p>Produces a structured single-line JSON object, ideal for log aggregation services:</p>

<pre><code class="language-typescript">{"timestamp":"2024-06-15T10:30:00.000Z","channel":"app","level":"info","message":"User logged in","context":{"userId":42}}
</code></pre>

<p>The <code>context</code> key is omitted when the context object has no keys.</p>

<p>Set the formatter in your channel config:</p>

<pre><code class="language-typescript">channels: {
  console: {
    driver: 'console',
    level: 'debug',
    formatter: 'json',
  },
}
</code></pre>

<h2 id="log-manager">LogManager</h2>
<p>The <code>LogManager</code> is the central class that manages channel resolution and caching. It implements both the <code>DriverManager</code> contract and the <code>LoggerDriver</code> interface, so you can use it directly as a logger (proxying to the default channel) or switch between channels explicitly.</p>

<h3 id="getting-the-log-manager">Getting the LogManager</h3>
<p>The <code>LoggingServiceProvider</code> registers the <code>LogManager</code> as a singleton in the IoC container. You can resolve it via the <code>log()</code> helper or directly from the container:</p>

<pre><code class="language-typescript">import { log } from '@mantiq/logging'

// Get the LogManager instance
const manager = log()

// Log directly on the manager (delegates to the default channel)
manager.info('Application started')
manager.error('Something went wrong', { code: 500 })
</code></pre>

<h3 id="switching-channels">Switching Channels</h3>
<p>Use the <code>channel()</code> or <code>driver()</code> method to get a specific channel&rsquo;s driver:</p>

<pre><code class="language-typescript">// Write to the file channel
log().channel('file').info('Request handled', { path: '/api/users' })

// Write to the daily channel
log().channel('daily').warning('Disk usage high', { percent: 92 })

// channel() and driver() are aliases
log().driver('console').debug('Debug info')
</code></pre>

<p>Channels are lazily resolved and cached. The first call to <code>channel('file')</code> creates the driver; subsequent calls return the same instance.</p>

<h3 id="log-level-methods">Log Level Methods</h3>
<p>The <code>LogManager</code> and all drivers support level-named convenience methods that delegate to <code>log()</code>:</p>

<pre><code class="language-typescript">const logger = log()

logger.emergency('System is unusable')
logger.alert('Action required immediately')
logger.critical('Critical failure', { service: 'database' })
logger.error('Operation failed', { error: err.message })
logger.warning('Deprecated API used', { endpoint: '/v1/users' })
logger.notice('User login from new device', { userId: 42 })
logger.info('Email sent', { to: 'alice@example.com' })
logger.debug('Query executed', { sql: 'SELECT * FROM users', ms: 12 })

// Or use the generic log() method with an explicit level
logger.log('info', 'Server started', { port: 3000 })
</code></pre>

<h3 id="forgetting-channels">Forgetting Channels</h3>
<p>You can clear cached channel instances, causing them to be re-created on next access:</p>

<pre><code class="language-typescript">// Forget a single channel
log().forgetChannel('file')

// Forget all channels
log().forgetChannels()
</code></pre>

<h2 id="the-log-helper">The log() Helper</h2>
<p>The <code>log()</code> helper is an overloaded function that resolves the <code>LogManager</code> from the application container:</p>

<pre><code class="language-typescript">import { log } from '@mantiq/logging'

// Without arguments: returns the LogManager
const manager = log()
manager.info('hello')

// With a channel name: returns that channel's driver directly
log('file').error('disk full', { partition: '/data' })
log('console').debug('request received')
</code></pre>

<h2 id="registering-the-service-provider">Registering the Service Provider</h2>
<p>Register <code>LoggingServiceProvider</code> in your application bootstrap:</p>

<pre><code class="language-typescript">import { LoggingServiceProvider } from '@mantiq/logging'

await app.registerProviders([
  CoreServiceProvider,
  LoggingServiceProvider,
  // ... other providers
])
await app.bootProviders()
</code></pre>

<p>The provider registers the <code>LogManager</code> as a singleton, reads the <code>logging</code> config from the <code>ConfigRepository</code>, and resolves relative log paths to absolute paths using the application&rsquo;s base path.</p>

<h2 id="extending-with-custom-drivers">Extending with Custom Drivers</h2>
<p>Register a custom driver factory using the <code>extend()</code> method on the <code>LogManager</code>:</p>

<pre><code class="language-typescript">import { log } from '@mantiq/logging'
import type { ChannelConfig, LoggerDriver } from '@mantiq/logging'

log().extend('webhook', (config: ChannelConfig): LoggerDriver =&gt; {
  return new WebhookDriver(config.url as string, config.level)
})
</code></pre>

<p>Then configure a channel to use your custom driver:</p>

<pre><code class="language-typescript">channels: {
  slack: {
    driver: 'webhook',
    url: 'https://hooks.slack.com/services/...',
    level: 'error',
  },
}
</code></pre>

<p>The factory receives the full <code>ChannelConfig</code> object, including any extra keys you define.</p>

<h2 id="practical-examples">Practical Examples</h2>

<h3 id="logging-in-controllers">Logging in Controllers</h3>
<pre><code class="language-typescript">import { log } from '@mantiq/logging'
import { MantiqResponse } from '@mantiq/core'
import type { MantiqRequest } from '@mantiq/core'

class OrderController {
  async store(request: MantiqRequest) {
    const data = await request.input()

    log().info('Creating order', { userId: data.userId, items: data.items.length })

    try {
      const order = await Order.create(data)
      log().info('Order created', { orderId: order.get('id') })
      return MantiqResponse.json(order.toObject(), 201)
    } catch (err) {
      log().error('Order creation failed', { error: err.message, userId: data.userId })
      return MantiqResponse.json({ error: 'Failed to create order' }, 500)
    }
  }
}
</code></pre>

<h3 id="logging-to-multiple-channels">Logging to Multiple Channels</h3>
<pre><code class="language-typescript">// Log a critical event to multiple channels explicitly
log('console').critical('Payment gateway unreachable', { gateway: 'stripe' })
log('daily').critical('Payment gateway unreachable', { gateway: 'stripe' })

// Or use a stack channel to fan out automatically
log('stack').critical('Payment gateway unreachable', { gateway: 'stripe' })
</code></pre>

<h3 id="structured-json-logging">Structured JSON Logging</h3>
<pre><code class="language-typescript">// Configure a channel with JSON formatting for log aggregation
channels: {
  aggregator: {
    driver: 'file',
    path: 'storage/logs/structured.log',
    level: 'info',
    formatter: 'json',
  },
}

// Each log line is a single JSON object
// {"timestamp":"...","channel":"aggregator","level":"info","message":"Request handled","context":{"method":"GET","path":"/api/users","ms":45}}
</code></pre>

<h2 id="testing-with-logfake">Testing with LogFake</h2>
<p>The <code>LogFake</code> class is a fake logger driver that records all log messages in memory without producing output. It provides assertion methods for verifying logging behavior in tests.</p>

<h3 id="basic-usage">Basic Usage</h3>
<pre><code class="language-typescript">import { LogFake } from '@mantiq/logging'

const fake = new LogFake()

fake.info('User logged in', { userId: 42 })
fake.error('Payment failed', { orderId: 123 })

// Assert a log was recorded at a given level
fake.assertLogged('info')
fake.assertLogged('error', 'Payment failed')
</code></pre>

<h3 id="assertion-methods">Assertion Methods</h3>
<table>
  <thead><tr><th>Method</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>assertLogged(level, message?, count?)</code></td><td>Assert that a matching log was recorded. Optionally match by exact string or regex, and assert an exact count.</td></tr>
    <tr><td><code>assertNotLogged(level, message?)</code></td><td>Assert that no matching log was recorded.</td></tr>
    <tr><td><code>assertNothingLogged()</code></td><td>Assert that no logs were recorded at all.</td></tr>
    <tr><td><code>assertLoggedCount(count)</code></td><td>Assert that exactly N total logs were recorded across all levels.</td></tr>
  </tbody>
</table>

<h3 id="matching-messages">Matching Messages</h3>
<p>Assertions support three matching modes:</p>
<ul>
  <li><strong>Level only:</strong> <code>fake.assertLogged('error')</code> &mdash; matches any message at that level</li>
  <li><strong>Exact string:</strong> <code>fake.assertLogged('error', 'Payment failed')</code> &mdash; exact equality match</li>
  <li><strong>Regex:</strong> <code>fake.assertLogged('error', /payment/i)</code> &mdash; regex test against the message</li>
</ul>

<h3 id="inspection-methods">Inspection Methods</h3>
<pre><code class="language-typescript">// Get all recorded log messages
const all = fake.all()  // LoggedMessage[]

// Get messages for a specific level
const errors = fake.forLevel('error')

// Check if a matching log exists (returns boolean, does not throw)
if (fake.hasLogged('warning', /deprecated/)) {
  // ...
}

// Clear all recorded logs
fake.reset()
</code></pre>

<h3 id="test-example">Test Example</h3>
<pre><code class="language-typescript">import { describe, it, expect } from 'bun:test'
import { LogFake, LogManager } from '@mantiq/logging'

describe('OrderService', () =&gt; {
  it('logs when an order is created', () =&gt; {
    const fake = new LogFake()

    // Use the fake as a logger in your service
    const service = new OrderService(fake)
    service.create({ userId: 1, items: ['widget'] })

    fake.assertLogged('info', 'Order created')
    fake.assertNotLogged('error')
    fake.assertLoggedCount(1)
  })

  it('logs errors on failure', () =&gt; {
    const fake = new LogFake()
    const service = new OrderService(fake)

    service.create({ userId: null, items: [] })

    fake.assertLogged('error', /failed/i)
    fake.assertLogged('error', undefined, 1)  // exactly one error
  })
})
</code></pre>

<h2 id="contracts-reference">Contracts Reference</h2>

<h3 id="loggerdriver-interface">LoggerDriver Interface</h3>
<p>All built-in drivers and the <code>LogManager</code> itself implement this interface:</p>

<pre><code class="language-typescript">interface LoggerDriver {
  log(level: LogLevel, message: string, context?: Record&lt;string, any&gt;): void
  emergency(message: string, context?: Record&lt;string, any&gt;): void
  alert(message: string, context?: Record&lt;string, any&gt;): void
  critical(message: string, context?: Record&lt;string, any&gt;): void
  error(message: string, context?: Record&lt;string, any&gt;): void
  warning(message: string, context?: Record&lt;string, any&gt;): void
  notice(message: string, context?: Record&lt;string, any&gt;): void
  info(message: string, context?: Record&lt;string, any&gt;): void
  debug(message: string, context?: Record&lt;string, any&gt;): void
}
</code></pre>

<h3 id="logentry-interface">LogEntry Interface</h3>
<p>The structured record passed to formatters:</p>

<pre><code class="language-typescript">interface LogEntry {
  level: LogLevel
  message: string
  context: Record&lt;string, any&gt;
  timestamp: Date
  channel: string
}
</code></pre>

<h3 id="logformatter-interface">LogFormatter Interface</h3>
<pre><code class="language-typescript">interface LogFormatter {
  format(entry: LogEntry): string
}
</code></pre>

<h3 id="channel-config-types">Channel Config Types</h3>
<pre><code class="language-typescript">interface ChannelConfig {
  driver: string
  level?: LogLevel
  formatter?: 'line' | 'json'
  [key: string]: unknown  // driver-specific options
}

interface LogConfig {
  default: string
  channels: Record&lt;string, ChannelConfig&gt;
}
</code></pre>
`
}
