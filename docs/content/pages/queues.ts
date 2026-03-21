export default {
  title: 'Queues',
  content: `
<h2 id="introduction">Introduction</h2>
<p>The <code>@mantiq/queue</code> package provides a unified API for dispatching and processing background jobs across multiple queue backends. It includes job dispatching, queue drivers, workers, retry/backoff logic, job chains, job batches, task scheduling, and testing fakes. The architecture is driver-based: swap from an in-memory sync driver during development to Redis, SQS, or Kafka in production without changing application code.</p>

<h2 id="configuration">Configuration</h2>
<p>Queue connections are configured in <code>config/queue.ts</code>. Define a default connection and as many named connections as you need:</p>

<pre><code class="language-typescript">export default {
  default: 'sqlite',

  connections: {
    sync: {
      driver: 'sync',
    },

    sqlite: {
      driver: 'sqlite',
      path: 'database/queue.sqlite',
    },

    redis: {
      driver: 'redis',
      host: '127.0.0.1',
      port: 6379,
      prefix: 'mantiq_queue',
    },

    sqs: {
      driver: 'sqs',
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
      region: 'us-east-1',
    },

    kafka: {
      driver: 'kafka',
      brokers: ['localhost:9092'],
      clientId: 'mantiq-queue',
      groupId: 'mantiq-workers',
    },
  },
}
</code></pre>

<p>If no <code>queue</code> config key exists, the framework defaults to a single <code>sync</code> connection.</p>

<h3 id="registering-the-service-provider">Registering the Service Provider</h3>
<p>Register <code>QueueServiceProvider</code> in your application bootstrap (<code>index.ts</code>):</p>

<pre><code class="language-typescript">import { QueueServiceProvider } from '@mantiq/queue'

await app.registerProviders([CoreServiceProvider, QueueServiceProvider])
await app.bootProviders()
</code></pre>

<h2 id="creating-jobs">Creating Jobs</h2>
<p>A job is a class that extends the abstract <code>Job</code> base class and implements a <code>handle()</code> method. Generate a new job with the CLI:</p>

<pre><code class="language-typescript">bun mantiq make:job ProcessPayment
</code></pre>

<p>This creates a file in <code>app/Jobs/ProcessPayment.ts</code>:</p>

<pre><code class="language-typescript">import { Job } from '@mantiq/queue'

export class ProcessPayment extends Job {
  override queue = 'default'
  override tries = 3

  // Add your own properties — they are automatically serialized
  orderId: number
  amount: number

  constructor(orderId: number, amount: number) {
    super()
    this.orderId = orderId
    this.amount = amount
  }

  override async handle(): Promise&lt;void&gt; {
    // Process the payment...
    console.log(\`Processing payment for order \${this.orderId}: $\${this.amount}\`)
  }

  /** Called when the job permanently fails after exhausting all retries */
  override async failed(error: Error): Promise&lt;void&gt; {
    console.error(\`Payment failed for order \${this.orderId}:\`, error.message)
  }
}
</code></pre>

<h3 id="job-properties">Job Properties</h3>
<p>The <code>Job</code> base class provides the following configurable properties:</p>

<table>
  <thead>
    <tr><th>Property</th><th>Default</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>queue</code></td><td><code>'default'</code></td><td>Queue name this job is dispatched to</td></tr>
    <tr><td><code>connection</code></td><td><code>null</code></td><td>Connection name (<code>null</code> uses the default connection)</td></tr>
    <tr><td><code>tries</code></td><td><code>3</code></td><td>Maximum number of attempts before permanent failure</td></tr>
    <tr><td><code>backoff</code></td><td><code>'0'</code></td><td>Backoff strategy between retries (see below)</td></tr>
    <tr><td><code>timeout</code></td><td><code>60</code></td><td>Maximum execution time in seconds</td></tr>
    <tr><td><code>delay</code></td><td><code>0</code></td><td>Delay in seconds before the job becomes available</td></tr>
    <tr><td><code>attempts</code></td><td><code>0</code></td><td>Current attempt number (set by the Worker)</td></tr>
    <tr><td><code>jobId</code></td><td><code>null</code></td><td>Queue driver's job ID (set after push)</td></tr>
  </tbody>
</table>

<h3 id="serialization">Serialization</h3>
<p>When a job is dispatched, <code>serialize()</code> separates framework config properties from user-defined properties. Any property you add to your job subclass (like <code>orderId</code> and <code>amount</code> above) is automatically collected into the <code>data</code> object of the serialized payload. The Worker reconstructs the job instance and assigns these properties back when processing.</p>

<h2 id="dispatching-jobs">Dispatching Jobs</h2>
<p>Use the <code>dispatch()</code> helper to push a job onto the queue. It returns a thenable <code>PendingDispatch</code>, so you can <code>await</code> it directly or chain fluent methods:</p>

<pre><code class="language-typescript">import { dispatch } from '@mantiq/queue'
import { ProcessPayment } from '../app/Jobs/ProcessPayment.ts'

// Simple dispatch
await dispatch(new ProcessPayment(42, 99.99))

// Dispatch with a 60-second delay
await dispatch(new ProcessPayment(42, 99.99)).delay(60)

// Dispatch to a specific queue
await dispatch(new ProcessPayment(42, 99.99)).onQueue('payments')

// Dispatch to a specific connection
await dispatch(new ProcessPayment(42, 99.99)).onConnection('redis')

// Chain multiple overrides
await dispatch(new ProcessPayment(42, 99.99))
  .delay(30)
  .onQueue('high')
  .onConnection('redis')
</code></pre>

<h3 id="the-queue-helper">The queue() Helper</h3>
<p>The <code>queue()</code> helper gives you direct access to a queue driver instance:</p>

<pre><code class="language-typescript">import { queue } from '@mantiq/queue'

// Get the size of the default queue
const size = await queue().size('default')

// Use a specific connection
const redisSize = await queue('redis').size('payments')

// Clear all jobs on a queue
await queue().clear('default')
</code></pre>

<h2 id="job-registry">Job Registry</h2>
<p>Jobs must be registered before the Worker can process them. The registry maps job class names to their constructors for deserialization:</p>

<pre><code class="language-typescript">import { registerJob, registerJobs } from '@mantiq/queue'
import { ProcessPayment } from '../app/Jobs/ProcessPayment.ts'
import { SendEmail } from '../app/Jobs/SendEmail.ts'
import { GenerateReport } from '../app/Jobs/GenerateReport.ts'

// Register a single job
registerJob(ProcessPayment)

// Register multiple jobs at once
registerJobs([ProcessPayment, SendEmail, GenerateReport])
</code></pre>

<p>Register all your job classes before starting the worker. If a worker encounters an unregistered job class, it will immediately fail that job.</p>

<h2 id="retry-and-backoff">Retry and Backoff</h2>
<p>When a job throws an exception and has remaining attempts, the Worker releases it back to the queue with a delay calculated from the job's <code>backoff</code> property. The <code>backoff</code> string supports four strategies:</p>

<table>
  <thead>
    <tr><th>Strategy</th><th>Example</th><th>Behavior</th></tr>
  </thead>
  <tbody>
    <tr><td>No delay</td><td><code>'0'</code></td><td>Retry immediately (0 seconds)</td></tr>
    <tr><td>Fixed</td><td><code>'30'</code></td><td>Wait 30 seconds between every retry</td></tr>
    <tr><td>Custom per attempt</td><td><code>'30,60,120'</code></td><td>Wait 30s, then 60s, then 120s (clamps to last value)</td></tr>
    <tr><td>Exponential</td><td><code>'exponential:10'</code></td><td>10s, 20s, 40s, 80s, 160s... (N &times; 2^(attempt-1))</td></tr>
  </tbody>
</table>

<pre><code class="language-typescript">import { Job } from '@mantiq/queue'

export class FetchExternalApi extends Job {
  override tries = 5
  override backoff = 'exponential:10' // 10s, 20s, 40s, 80s, 160s
  override timeout = 30

  override async handle(): Promise&lt;void&gt; {
    // If this throws, the worker will retry with exponential backoff
  }
}
</code></pre>

<h2 id="drivers">Drivers</h2>

<h3 id="sync-driver">Sync Driver</h3>
<p>An in-memory driver useful for development and testing. Jobs are stored in a <code>Map</code>. No persistence across restarts.</p>

<pre><code class="language-typescript">// config/queue.ts
sync: {
  driver: 'sync',
}
</code></pre>

<h3 id="sqlite-driver">SQLite Driver</h3>
<p>A SQLite-backed driver using <code>bun:sqlite</code>. Auto-creates three tables on first use: <code>queue_jobs</code>, <code>queue_failed_jobs</code>, and <code>queue_batches</code>. Uses WAL mode and atomic transactions for safe concurrent access.</p>

<pre><code class="language-typescript">// config/queue.ts
sqlite: {
  driver: 'sqlite',
  path: 'database/queue.sqlite',
}
</code></pre>

<h3 id="redis-driver">Redis Driver</h3>
<p>A Redis-backed driver using <code>ioredis</code> (optional peer dependency). Uses Lua scripts for atomic operations like delayed job migration and batch progress updates.</p>

<pre><code class="language-typescript">// config/queue.ts
redis: {
  driver: 'redis',
  host: '127.0.0.1',
  port: 6379,
  password: undefined,
  db: 0,
  prefix: 'mantiq_queue',
}
</code></pre>

<p>You can also connect via a URL:</p>

<pre><code class="language-typescript">redis: {
  driver: 'redis',
  url: 'redis://:password@host:6379/0',
  prefix: 'mantiq_queue',
}
</code></pre>

<h3 id="sqs-driver">SQS Driver</h3>
<p>An Amazon SQS driver using <code>@aws-sdk/client-sqs</code> (optional peer dependency). Maps queue operations to SQS API calls with long-polling support.</p>

<pre><code class="language-typescript">// config/queue.ts
sqs: {
  driver: 'sqs',
  queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'your-key',
    secretAccessKey: 'your-secret',
  },
  visibilityTimeout: 60,
  waitTimeSeconds: 5,
}
</code></pre>

<p>SQS caps delays at 900 seconds (15 minutes); larger values are clamped automatically. Failed jobs and batches are tracked in-memory since SQS has no native storage for these.</p>

<h3 id="kafka-driver">Kafka Driver</h3>
<p>A Kafka driver using <code>kafkajs</code> (optional peer dependency). Maps queue names to Kafka topics with a configurable prefix.</p>

<pre><code class="language-typescript">// config/queue.ts
kafka: {
  driver: 'kafka',
  brokers: ['localhost:9092'],
  clientId: 'mantiq-queue',
  groupId: 'mantiq-workers',
  topicPrefix: 'mantiq.',
  ssl: false,
  sasl: {
    mechanism: 'plain',
    username: 'user',
    password: 'pass',
  },
}
</code></pre>

<h3 id="custom-drivers">Custom Drivers</h3>
<p>You can register custom queue drivers via the <code>QueueManager.extend()</code> method:</p>

<pre><code class="language-typescript">import { getQueueManager } from '@mantiq/queue'
import type { QueueDriver, QueueConnectionConfig } from '@mantiq/queue'

const manager = getQueueManager()

manager.extend('rabbitmq', (config: QueueConnectionConfig): QueueDriver =&gt; {
  return new RabbitMQDriver(config)
})
</code></pre>

<h2 id="job-chains">Job Chains</h2>
<p>Chains execute jobs sequentially. Each job runs only after the previous one succeeds. If a chained job permanently fails, the remaining jobs are skipped and an optional catch handler is dispatched.</p>

<pre><code class="language-typescript">import { Bus } from '@mantiq/queue'

// Chain three jobs — they run in order
await Bus.chain([
  new ProcessPodcast(podcastId),
  new OptimizeAudio(podcastId),
  new PublishPodcast(podcastId),
])

// Add a catch handler for chain failures
await Bus.chain([
  new ProcessPodcast(podcastId),
  new OptimizeAudio(podcastId),
  new PublishPodcast(podcastId),
])
  .catch(new NotifyPodcastFailed(podcastId))

// Override queue and connection for the entire chain
await Bus.chain([
  new ProcessPodcast(podcastId),
  new OptimizeAudio(podcastId),
])
  .onQueue('podcasts')
  .onConnection('redis')
</code></pre>

<p>Under the hood, only the first job is pushed to the queue. The remaining jobs are serialized into the first job's payload as <code>chainedJobs</code>. When the Worker successfully processes a job with chained jobs, it pops the next payload, passes the remaining chain forward, and pushes it to the queue.</p>

<p>You can also create chains using the <code>Chain</code> class directly:</p>

<pre><code class="language-typescript">import { Chain } from '@mantiq/queue'

await Chain.of([
  new StepOne(),
  new StepTwo(),
  new StepThree(),
]).dispatch()
</code></pre>

<h2 id="job-batches">Job Batches</h2>
<p>Batches dispatch multiple jobs in parallel with progress tracking. All batch jobs are dispatched immediately and the Worker updates progress counters as each job completes. Lifecycle callbacks fire when the batch finishes.</p>

<pre><code class="language-typescript">import { Bus } from '@mantiq/queue'

const batch = await Bus.batch([
  new ImportUser(1),
  new ImportUser(2),
  new ImportUser(3),
  new ImportUser(4),
])
  .name('user-import')
  .then(new NotifyImportComplete())
  .catch(new NotifyImportFailed())
  .finally(new CleanupImportFiles())
  .onQueue('imports')
  .allowFailures()
  .dispatch()

// Inspect the batch
console.log(batch.id)          // UUID
console.log(batch.totalJobs)   // 4
console.log(batch.progress())  // 0 (initially)
</code></pre>

<h3 id="inspecting-batches">Inspecting Batches</h3>
<p>The <code>Batch</code> object returned from <code>dispatch()</code> provides read access to batch state:</p>

<pre><code class="language-typescript">batch.id              // string (UUID)
batch.name            // string
batch.totalJobs       // number
batch.processedJobs   // number
batch.failedJobs      // number
batch.cancelled       // boolean
batch.progress()      // number (0-100)
batch.finished()      // boolean
batch.hasFailures()   // boolean

// Refresh state from the driver
const freshBatch = await batch.fresh()

// Cancel the batch — pending jobs will be skipped
await batch.cancel()
</code></pre>

<h3 id="batch-lifecycle-callbacks">Batch Lifecycle Callbacks</h3>
<table>
  <thead>
    <tr><th>Callback</th><th>Fires when</th></tr>
  </thead>
  <tbody>
    <tr><td><code>then(job)</code></td><td>All jobs succeed (or <code>allowFailures()</code> is set)</td></tr>
    <tr><td><code>catch(job)</code></td><td>Any job fails (and <code>allowFailures()</code> is not set)</td></tr>
    <tr><td><code>finally(job)</code></td><td>Batch completes, regardless of success or failure</td></tr>
  </tbody>
</table>

<h2 id="worker">Worker</h2>
<p>The Worker is a poll loop that pops jobs from the queue, executes them, and handles retries, chain continuation, and batch progress. Start it with the CLI or programmatically.</p>

<h3 id="starting-the-worker">Starting the Worker</h3>

<pre><code class="language-typescript">bun mantiq queue:work
</code></pre>

<p>Worker options:</p>

<table>
  <thead>
    <tr><th>Option</th><th>Default</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>--queue</code></td><td><code>default</code></td><td>Queue names to listen on (comma-separated)</td></tr>
    <tr><td><code>--sleep</code></td><td><code>3</code></td><td>Seconds to sleep when no jobs are available</td></tr>
    <tr><td><code>--tries</code></td><td><code>3</code></td><td>Default max attempts (overridden by job's <code>tries</code>)</td></tr>
    <tr><td><code>--timeout</code></td><td><code>60</code></td><td>Default timeout in seconds (overridden by job's <code>timeout</code>)</td></tr>
    <tr><td><code>--stop-when-empty</code></td><td><code>false</code></td><td>Stop when the queue is empty</td></tr>
    <tr><td><code>--max-jobs</code></td><td><code>0</code></td><td>Max jobs to process before stopping (0 = unlimited)</td></tr>
    <tr><td><code>--max-time</code></td><td><code>0</code></td><td>Max seconds to run before stopping (0 = unlimited)</td></tr>
    <tr><td><code>--connection</code></td><td><em>default</em></td><td>Connection name to use</td></tr>
  </tbody>
</table>

<pre><code class="language-typescript">// Listen on multiple queues with priority ordering
bun mantiq queue:work --queue=high,default,low

// Process at most 100 jobs, then exit
bun mantiq queue:work --max-jobs=100

// Run for at most 1 hour
bun mantiq queue:work --max-time=3600

// Use the redis connection
bun mantiq queue:work --connection=redis
</code></pre>

<h3 id="programmatic-worker">Programmatic Worker</h3>

<pre><code class="language-typescript">import { Worker, getQueueManager } from '@mantiq/queue'

const worker = new Worker(getQueueManager(), {
  queue: 'default,emails',
  sleep: 3,
  tries: 3,
  timeout: 60,
  stopWhenEmpty: false,
  maxJobs: 0,
  maxTime: 0,
})

await worker.run()

// Check status
worker.isRunning()        // boolean
worker.getJobsProcessed() // number

// Graceful shutdown
worker.stop()
</code></pre>

<h3 id="job-processing-lifecycle">Job Processing Lifecycle</h3>
<p>When the Worker pops a job, it follows this lifecycle:</p>

<ol>
  <li><strong>Batch cancellation check:</strong> If the job has a <code>batchId</code>, the batch is looked up. If cancelled, the job is deleted and skipped.</li>
  <li><strong>Job resolution:</strong> The job class name is looked up in the registry. If not found, the job fails immediately.</li>
  <li><strong>Reconstruction:</strong> A new instance is created and populated with the serialized data and framework config.</li>
  <li><strong>Execution:</strong> <code>JobProcessing</code> event fires, then <code>handle()</code> runs with a timeout enforced via <code>Promise.race()</code>.</li>
  <li><strong>On success:</strong> The job is deleted, <code>JobProcessed</code> fires, chain continuation and batch progress are handled.</li>
  <li><strong>On failure (retryable):</strong> <code>JobExceptionOccurred</code> fires, backoff delay is calculated, job is released back to the queue.</li>
  <li><strong>On failure (permanent):</strong> <code>JobExceptionOccurred</code> and <code>JobFailed</code> fire, <code>job.failed()</code> is called, the job is moved to the failed list.</li>
</ol>

<h2 id="events">Events</h2>
<p>The queue system fires events at key points in the job lifecycle. Listen for these events using the <code>@mantiq/core</code> event dispatcher:</p>

<pre><code class="language-typescript">import { JobProcessing, JobProcessed, JobFailed, JobExceptionOccurred } from '@mantiq/queue'

// Fired just before handle() is called
events.listen(JobProcessing, (event) =&gt; {
  console.log('Processing:', event.payload.jobName)
})

// Fired after handle() completes successfully
events.listen(JobProcessed, (event) =&gt; {
  console.log('Completed:', event.payload.jobName)
})

// Fired when a job permanently fails (exhausted all retries)
events.listen(JobFailed, (event) =&gt; {
  console.error('Failed:', event.payload.jobName, event.error.message)
})

// Fired when a job throws (may still be retried)
events.listen(JobExceptionOccurred, (event) =&gt; {
  console.warn('Exception:', event.payload.jobName, event.error.message)
})
</code></pre>

<h2 id="scheduling">Task Scheduling</h2>
<p>The <code>Schedule</code> class lets you define recurring tasks using a fluent, cron-like API. You can schedule CLI commands, queued jobs, or arbitrary callbacks.</p>

<pre><code class="language-typescript">import { Schedule } from '@mantiq/queue'

const schedule = new Schedule()

// Schedule a CLI command to run daily at midnight
schedule.command('cache:prune').daily()

// Schedule a job to run every 5 minutes
schedule.job(ProcessAnalytics, { format: 'pdf' }).everyFiveMinutes()

// Schedule a callback to run hourly at minute 30
schedule.call(() =&gt; {
  console.log('Hourly check at :30')
}).hourlyAt(30)

// Custom cron expression
schedule.command('reports:generate').cron('15 3 * * 1')
  .describedAs('Weekly report generation')
</code></pre>

<h3 id="schedule-frequency-options">Frequency Options</h3>

<table>
  <thead>
    <tr><th>Method</th><th>Cron Expression</th></tr>
  </thead>
  <tbody>
    <tr><td><code>everyMinute()</code></td><td><code>* * * * *</code></td></tr>
    <tr><td><code>everyFiveMinutes()</code></td><td><code>*/5 * * * *</code></td></tr>
    <tr><td><code>everyTenMinutes()</code></td><td><code>*/10 * * * *</code></td></tr>
    <tr><td><code>everyFifteenMinutes()</code></td><td><code>*/15 * * * *</code></td></tr>
    <tr><td><code>everyThirtyMinutes()</code></td><td><code>*/30 * * * *</code></td></tr>
    <tr><td><code>hourly()</code></td><td><code>0 * * * *</code></td></tr>
    <tr><td><code>hourlyAt(minute)</code></td><td><code>{minute} * * * *</code></td></tr>
    <tr><td><code>daily()</code></td><td><code>0 0 * * *</code></td></tr>
    <tr><td><code>dailyAt(time)</code></td><td>e.g. <code>'14:30'</code> becomes <code>30 14 * * *</code></td></tr>
    <tr><td><code>twiceDaily(hour1, hour2)</code></td><td>defaults: 1 and 13</td></tr>
    <tr><td><code>weekly()</code></td><td><code>0 0 * * 0</code></td></tr>
    <tr><td><code>weeklyOn(day, time)</code></td><td>specific day and optional time</td></tr>
    <tr><td><code>monthly()</code></td><td><code>0 0 1 * *</code></td></tr>
    <tr><td><code>monthlyOn(day, time)</code></td><td>specific day and optional time</td></tr>
    <tr><td><code>yearly()</code></td><td><code>0 0 1 1 *</code></td></tr>
    <tr><td><code>cron(expression)</code></td><td>any valid cron expression</td></tr>
  </tbody>
</table>

<p>Cron expressions support wildcards (<code>*</code>), ranges (<code>1-5</code>), steps (<code>*/5</code>, <code>1-30/5</code>), and comma-separated values (<code>1,15,30</code>).</p>

<h3 id="running-the-scheduler">Running the Scheduler</h3>
<p>Run all due scheduled entries with the CLI:</p>

<pre><code class="language-typescript">bun mantiq schedule:run
</code></pre>

<p>For <code>command</code> entries, the command is executed. For <code>job</code> entries, the job is dispatched via <code>dispatch()</code>. For <code>callback</code> entries, the function is called directly.</p>

<h2 id="cli-commands">CLI Commands</h2>

<h3 id="queue-work"><code>queue:work</code></h3>
<p>Starts a Worker to process jobs from the queue. Registers SIGINT/SIGTERM handlers for graceful shutdown.</p>
<pre><code class="language-typescript">bun mantiq queue:work [--queue=default] [--sleep=3] [--tries=3] [--timeout=60]
                       [--stop-when-empty] [--max-jobs=0] [--max-time=0] [--connection=]
</code></pre>

<h3 id="queue-retry"><code>queue:retry</code></h3>
<p>Retries failed job(s). Pass a specific job ID or <code>all</code> to retry every failed job.</p>
<pre><code class="language-typescript">bun mantiq queue:retry 42
bun mantiq queue:retry all
</code></pre>

<h3 id="queue-failed"><code>queue:failed</code></h3>
<p>Lists all failed jobs in a table with columns: ID, Queue, Job, Failed At, Error.</p>
<pre><code class="language-typescript">bun mantiq queue:failed
</code></pre>

<h3 id="queue-flush"><code>queue:flush</code></h3>
<p>Deletes all failed jobs.</p>
<pre><code class="language-typescript">bun mantiq queue:flush
</code></pre>

<h3 id="make-job"><code>make:job</code></h3>
<p>Generates a job class stub in <code>app/Jobs/</code> with <code>queue</code>, <code>tries</code>, <code>handle()</code>, and proper <code>override</code> keywords.</p>
<pre><code class="language-typescript">bun mantiq make:job SendWelcomeEmail
</code></pre>

<h3 id="schedule-run"><code>schedule:run</code></h3>
<p>Runs all due scheduled entries.</p>
<pre><code class="language-typescript">bun mantiq schedule:run
</code></pre>

<h2 id="standalone-usage">Standalone Usage</h2>
<p>You can use <code>@mantiq/queue</code> without <code>@mantiq/core</code> via the <code>createQueueManager()</code> factory. This creates a QueueManager with only the <code>sync</code> and <code>sqlite</code> built-in drivers:</p>

<pre><code class="language-typescript">import { createQueueManager, dispatch, registerJob } from '@mantiq/queue'

const manager = createQueueManager({
  default: 'sync',
  connections: {
    sync: { driver: 'sync' },
  },
})

registerJob(MyJob)

await dispatch(new MyJob())
</code></pre>

<h2 id="testing">Testing with QueueFake</h2>
<p><code>QueueFake</code> is a fake queue driver that records pushed jobs without executing them. Use it in tests to assert that jobs were dispatched correctly without running actual job logic.</p>

<pre><code class="language-typescript">import { QueueFake, dispatch, setQueueManager, QueueManager } from '@mantiq/queue'
import { ProcessPayment } from '../app/Jobs/ProcessPayment.ts'
import { SendReceipt } from '../app/Jobs/SendReceipt.ts'

// Set up the fake
const fake = new QueueFake()

// Use it in your tests...

// Assert a job was pushed
fake.assertPushed(ProcessPayment)

// Assert a job was pushed exactly twice
fake.assertPushed(ProcessPayment, 2)

// Assert a job was pushed to a specific queue
fake.assertPushedOn('payments', ProcessPayment)

// Assert a job was NOT pushed
fake.assertNotPushed(SendReceipt)

// Assert nothing was pushed at all
fake.assertNothingPushed()

// Assert a chain was dispatched in order
fake.assertChained([ProcessPayment, SendReceipt])

// Assert a batch was dispatched
fake.assertBatched()

// Assert a batch was dispatched and inspect the jobs
fake.assertBatched((jobs) =&gt; {
  expect(jobs.length).toBe(3)
})

// Query pushed jobs for a specific class
const payments = fake.pushed(ProcessPayment)
// payments is PushedJob[] with { payload, queue, delay }

// Reset for test isolation
fake.reset()
</code></pre>

<h2 id="errors">Errors</h2>
<p>The queue package defines three error classes:</p>

<pre><code class="language-typescript">import { QueueError, JobTimeoutError, MaxAttemptsExceededError } from '@mantiq/queue'
</code></pre>

<table>
  <thead>
    <tr><th>Error</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>QueueError</code></td><td>Base error for all queue-related failures (extends <code>MantiqError</code>)</td></tr>
    <tr><td><code>JobTimeoutError</code></td><td>Thrown when a job exceeds its <code>timeout</code>. Message: <code>Job "Name" exceeded timeout of Ns</code></td></tr>
    <tr><td><code>MaxAttemptsExceededError</code></td><td>Thrown when a job exhausts all retry attempts. Message: <code>Job "Name" has been attempted N times</code></td></tr>
  </tbody>
</table>
`
}
