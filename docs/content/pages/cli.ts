export default {
  title: 'CLI Commands',
  content: `
<h2>Introduction</h2>
<p>MantiqJS includes a powerful CLI tool powered by the <code>@mantiq/cli</code> package. It provides 37 built-in commands for generating boilerplate, managing database migrations, seeding data, starting the development server, and more. The CLI kernel uses auto-discovery, so you do not need to manually register commands.</p>

<h2>Running Commands</h2>
<p>All commands are invoked through the <code>mantiq</code> entry point using Bun:</p>

<pre><code class="language-bash">bun mantiq &lt;command&gt; [arguments] [options]
</code></pre>

<p>To see a list of all available commands:</p>

<pre><code class="language-bash">bun mantiq help
</code></pre>

<p>The help output groups commands by prefix (e.g., all <code>make:*</code> commands together, all <code>migrate:*</code> commands together) for easy browsing.</p>

<h2>The Auto-Discovering Kernel</h2>
<p>The CLI kernel (<code>mantiq.ts</code>) uses auto-discovery. You do not need to manually register any commands:</p>

<pre><code class="language-typescript">#!/usr/bin/env bun
await import('./index.ts')

import { Kernel } from '@mantiq/cli'

const kernel = new Kernel()
const code = await kernel.run()
process.exit(code)
</code></pre>

<p>The <code>Kernel</code> constructor takes no arguments. It automatically registers all built-in commands and discovers any custom commands in <code>app/Console/Commands/</code>.</p>

<h2>Generator Commands</h2>
<p>Generator commands scaffold new files with the correct boilerplate, saving you from writing repetitive code by hand.</p>

<h3>make:model</h3>
<p>Create a new model class:</p>

<pre><code class="language-bash">bun mantiq make:model User
# Creates: app/Models/User.ts

bun mantiq make:model Post --migration
# Creates the model AND a migration file
</code></pre>

<h3>make:controller</h3>
<p>Create a new controller class:</p>

<pre><code class="language-bash">bun mantiq make:controller UserController
# Creates: app/Http/Controllers/UserController.ts

bun mantiq make:controller PostController --resource
# Creates a controller with index, show, store, update, destroy methods
</code></pre>

<h3>make:migration</h3>
<p>Create a new database migration file:</p>

<pre><code class="language-bash">bun mantiq make:migration create_users_table
# Creates: database/migrations/2026_03_19_000001_create_users_table.ts

bun mantiq make:migration add_avatar_to_users
# Creates a migration with a timestamped filename
</code></pre>

<h3>make:factory</h3>
<p>Create a new model factory:</p>

<pre><code class="language-bash">bun mantiq make:factory UserFactory
# Creates: database/factories/UserFactory.ts
</code></pre>

<h3>make:seeder</h3>
<p>Create a new database seeder:</p>

<pre><code class="language-bash">bun mantiq make:seeder UserSeeder
# Creates: database/seeders/UserSeeder.ts
</code></pre>

<h3>make:middleware</h3>
<p>Create a new middleware class:</p>

<pre><code class="language-bash">bun mantiq make:middleware EnsureIsAdmin
# Creates: app/Http/Middleware/EnsureIsAdmin.ts
</code></pre>

<h3>make:request</h3>
<p>Create a new form request class:</p>

<pre><code class="language-bash">bun mantiq make:request StorePostRequest
# Creates: app/Requests/StorePostRequest.ts
</code></pre>

<h3>make:event</h3>
<p>Create a new event class:</p>

<pre><code class="language-bash">bun mantiq make:event OrderShipped
# Creates: app/Events/OrderShipped.ts
</code></pre>

<h3>make:listener</h3>
<p>Create a new event listener:</p>

<pre><code class="language-bash">bun mantiq make:listener SendShipmentNotification
# Creates: app/Listeners/SendShipmentNotification.ts
</code></pre>

<h3>make:job</h3>
<p>Create a new queued job:</p>

<pre><code class="language-bash">bun mantiq make:job ProcessPayment
# Creates: app/Jobs/ProcessPayment.ts
</code></pre>

<h3>make:command</h3>
<p>Create a new CLI command:</p>

<pre><code class="language-bash">bun mantiq make:command SendReminders
# Creates: app/Console/Commands/SendRemindersCommand.ts
</code></pre>

<h3>More Generators</h3>
<p>Additional generator commands include:</p>
<ul>
  <li><code>make:provider</code> &mdash; Create a new service provider</li>
  <li><code>make:policy</code> &mdash; Create a new authorization policy</li>
  <li><code>make:observer</code> &mdash; Create a new model observer</li>
  <li><code>make:rule</code> &mdash; Create a new validation rule</li>
  <li><code>make:exception</code> &mdash; Create a new exception class</li>
  <li><code>make:mail</code> &mdash; Create a new mailable class</li>
  <li><code>make:notification</code> &mdash; Create a new notification class</li>
  <li><code>make:test</code> &mdash; Create a new test file</li>
</ul>

<h2>Database Commands</h2>
<p>These commands manage your database schema through the migration system.</p>

<h3>migrate</h3>
<p>Run all pending migrations:</p>

<pre><code class="language-bash">bun mantiq migrate
# Runs all migrations that have not yet been executed
</code></pre>

<h3>migrate:rollback</h3>
<p>Roll back the most recent batch of migrations:</p>

<pre><code class="language-bash">bun mantiq migrate:rollback
# Rolls back the last batch

bun mantiq migrate:rollback --steps=3
# Rolls back the last 3 batches
</code></pre>

<h3>migrate:fresh</h3>
<p>Drop all tables and re-run every migration from scratch:</p>

<pre><code class="language-bash">bun mantiq migrate:fresh
# WARNING: Destroys all data! Useful for development.

bun mantiq migrate:fresh --seed
# Fresh migration + run seeders
</code></pre>

<p><code>migrate:fresh</code> drops all tables in the database and re-runs migrations. All existing data will be permanently lost &mdash; never run this in production.</p>

<h3>migrate:reset</h3>
<p>Roll back all migrations (return to a clean database):</p>

<pre><code class="language-bash">bun mantiq migrate:reset
# Rolls back every migration that has been run
</code></pre>

<h3>migrate:status</h3>
<p>View the status of all migrations:</p>

<pre><code class="language-bash">bun mantiq migrate:status
# Shows each migration, whether it has been run, and its batch number
</code></pre>

<h3>seed</h3>
<p>Run the database seeders:</p>

<pre><code class="language-bash">bun mantiq seed
# Runs the DatabaseSeeder (which can call other seeders)
</code></pre>

<h2>Utility Commands</h2>

<h3>serve</h3>
<p>Start the development server:</p>

<pre><code class="language-bash">bun mantiq serve
# Starts the server on the configured port (default: 3000)

bun mantiq serve --port=8080
# Start on a specific port
</code></pre>

<h3>route:list</h3>
<p>Display all registered routes in a formatted table:</p>

<pre><code class="language-bash">bun mantiq route:list
# Shows: Method | URI | Name | Controller | Middleware
</code></pre>

<h3>key:generate</h3>
<p>Generate a new application encryption key:</p>

<pre><code class="language-bash">bun mantiq key:generate
# Generates a random APP_KEY and writes it to .env
</code></pre>

<h3>config:cache / config:clear</h3>
<p>Cache or clear the configuration for production:</p>

<pre><code class="language-bash">bun mantiq config:cache
# Writes bootstrap/cache/config.json

bun mantiq config:clear
# Removes the cached config file
</code></pre>

<h3>schema:generate</h3>
<p>Generate TypeScript interfaces from your database schema:</p>

<pre><code class="language-bash">bun mantiq schema:generate
# Generates TypeScript interfaces from the current database schema
</code></pre>

<h3>Other Utility Commands</h3>
<ul>
  <li><code>about</code> &mdash; Display information about the application</li>
  <li><code>tinker</code> &mdash; Open an interactive REPL with the application bootstrapped</li>
  <li><code>cache:clear</code> &mdash; Clear the application cache</li>
  <li><code>storage:link</code> &mdash; Create the symbolic link for public storage</li>
  <li><code>down</code> &mdash; Put the application into maintenance mode</li>
  <li><code>up</code> &mdash; Bring the application out of maintenance mode</li>
</ul>

<h2>Writing Custom Commands</h2>
<p>Create custom commands by extending the <code>Command</code> base class. Place them in <code>app/Console/Commands/</code> and the Discoverer will register them automatically:</p>

<pre><code class="language-typescript">// app/Console/Commands/SendRemindersCommand.ts
import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'

export class SendRemindersCommand extends Command {
  override name = 'reminders:send'
  override description = 'Send pending reminders to users'
  override usage = 'reminders:send [--force]'

  override async handle(args: ParsedArgs): Promise&lt;number&gt; {
    const force = args.flags['force'] ?? false

    this.io.heading('Sending Reminders')

    const users = await User.where('reminder_due', '&lt;=', new Date()).get()
    this.io.line(\`Found \${users.length} pending reminders.\`)

    if (users.length === 0) {
      this.io.line('Nothing to send.')
      return 0
    }

    for (const user of users) {
      await sendReminder(user)
      this.io.line(\`  Sent to \${user.get('email')}\`)
    }

    this.io.line('')
    this.io.line(\`Done! Sent \${users.length} reminders.\`)
    return 0  // exit code 0 = success
  }
}
</code></pre>

<p>Or generate the boilerplate with:</p>

<pre><code class="language-bash">bun mantiq make:command SendReminders
# Creates: app/Console/Commands/SendRemindersCommand.ts
</code></pre>

<h2>The Command Base Class</h2>
<p>Every command extends <code>Command</code> and must define:</p>

<table>
  <thead><tr><th>Property/Method</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>name</code></td><td>The command name used to invoke it (e.g., <code>reminders:send</code>)</td></tr>
    <tr><td><code>description</code></td><td>Short description shown in the help listing</td></tr>
    <tr><td><code>usage</code> (optional)</td><td>Usage hint with argument placeholders</td></tr>
    <tr><td><code>handle(args)</code></td><td>The command logic. Returns an exit code (0 = success).</td></tr>
  </tbody>
</table>

<h3>Console Output</h3>
<p>The <code>io</code> property provides formatted output methods:</p>

<pre><code class="language-typescript">this.io.line('Regular output')
this.io.heading('Section Title')
this.io.error('Something went wrong')
this.io.success('Operation completed')
this.io.newLine()
this.io.twoColumn('Key', 'Value', 20)  // padded two-column layout
this.io.green('Success text')
this.io.yellow('Warning text')
</code></pre>

<h3>Parsed Arguments</h3>
<p>The <code>ParsedArgs</code> object provides access to the command name, positional arguments, and flags:</p>

<pre><code class="language-typescript">// bun mantiq make:model User --migration --force
args.command    // 'make:model'
args.args       // ['User']
args.flags      // { migration: true, force: true }
</code></pre>

<p>Commands are grouped by prefix in the help output. For example, <code>reminders:send</code> and <code>reminders:list</code> appear under a <code>reminders</code> section.</p>
`
}
