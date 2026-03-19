export default {
  title: 'CLI Commands',
  content: `
<h2>Introduction</h2>
<p>MantiqJS includes a powerful CLI tool powered by the <code>@mantiq/cli</code> package. It provides commands for generating boilerplate, managing database migrations, seeding data, starting the development server, and more. You can also write your own custom commands.</p>

<h2>Running Commands</h2>
<p>All commands are invoked through the <code>mantiq</code> entry point using Bun:</p>

<pre><code class="language-bash">bun mantiq &lt;command&gt; [arguments] [options]
</code></pre>

<p>To see a list of all available commands:</p>

<pre><code class="language-bash">bun mantiq help
</code></pre>

<p>The help output groups commands by prefix (e.g., all <code>make:*</code> commands together, all <code>migrate:*</code> commands together) for easy browsing.</p>

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
# Creates: app/Controllers/UserController.ts

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
# Creates: app/Middleware/EnsureIsAdmin.ts
</code></pre>

<h3>make:request</h3>
<p>Create a new form request class:</p>

<pre><code class="language-bash">bun mantiq make:request StorePostRequest
# Creates: app/Requests/StorePostRequest.ts
</code></pre>

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

<div class="warning">
<p><code>migrate:fresh</code> drops <strong>all</strong> tables in the database and re-runs migrations. All existing data will be permanently lost. Never run this in production.</p>
</div>

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

<p>This is useful for debugging routing issues and verifying that your routes are registered correctly.</p>

<h3>tinker</h3>
<p>Open an interactive REPL with your application bootstrapped:</p>

<pre><code class="language-bash">bun mantiq tinker
# Opens a REPL with access to your models, helpers, and services
</code></pre>

<p>Tinker boots the full application (container, config, providers) so you can interact with your models and services directly:</p>

<pre><code class="language-typescript">// Inside tinker
&gt; const users = await User.all()
&gt; users.length
42
&gt; await User.create({ name: 'Test', email: 'test@example.com', password: '...' })
</code></pre>

<h2>Writing Custom Commands</h2>
<p>Create custom commands by extending the <code>Command</code> base class:</p>

<pre><code class="language-typescript">import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'

class SendRemindersCommand extends Command {
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

<h3>Registering Custom Commands</h3>
<p>Register your commands in the CLI kernel:</p>

<pre><code class="language-typescript">import { Kernel } from '@mantiq/cli'

const kernel = new Kernel(app)

kernel.registerAll([
  new SendRemindersCommand(),
  new GenerateReportCommand(),
  // ... other custom commands
])

await kernel.run()
</code></pre>

<h2>The Command Base Class</h2>
<p>Every command extends <code>Command</code> and must define:</p>

<table>
  <thead><tr><th>Property/Method</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>name</code></td><td>The command name used to invoke it (e.g., <code>make:model</code>)</td></tr>
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

<div class="note">
<p>Commands are grouped by prefix in the help output. For example, <code>reminders:send</code> and <code>reminders:list</code> would appear under a <code>reminders</code> section, making it easy to discover related commands.</p>
</div>
`
}
