import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { MakeMailCommand } from '../../src/commands/MakeMailCommand.ts'
import { MakeNotificationCommand } from '../../src/commands/MakeNotificationCommand.ts'
import { MakeJobCommand } from '../../src/commands/MakeJobCommand.ts'
import { MakePolicyCommand } from '../../src/commands/MakePolicyCommand.ts'
import { MakeEventCommand } from '../../src/commands/MakeEventCommand.ts'
import { MakeListenerCommand } from '../../src/commands/MakeListenerCommand.ts'
import { MakeMiddlewareCommand } from '../../src/commands/MakeMiddlewareCommand.ts'
import { MakeRequestCommand } from '../../src/commands/MakeRequestCommand.ts'
import { MakeProviderCommand } from '../../src/commands/MakeProviderCommand.ts'
import { MakeObserverCommand } from '../../src/commands/MakeObserverCommand.ts'
import { MakeExceptionCommand } from '../../src/commands/MakeExceptionCommand.ts'
import { MakeRuleCommand } from '../../src/commands/MakeRuleCommand.ts'
import { MakeSeederCommand } from '../../src/commands/MakeSeederCommand.ts'
import { MakeFactoryCommand } from '../../src/commands/MakeFactoryCommand.ts'
import { MakeTestCommand } from '../../src/commands/MakeTestCommand.ts'
import { MakeCommandCommand } from '../../src/commands/MakeCommandCommand.ts'

// ── Helper ───────────────────────────────────────────────────────────────────

let tmpDir: string
let origCwd: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mantiq-cli-test-'))
  origCwd = process.cwd()
  process.chdir(tmpDir)
})

afterEach(() => {
  process.chdir(origCwd)
  rmSync(tmpDir, { recursive: true, force: true })
})

function args(name: string, flags: Record<string, any> = {}): any {
  return { args: [name], flags, options: {} }
}

function readFile(path: string): string {
  return readFileSync(join(tmpDir, path), 'utf-8')
}

function fileExists(path: string): boolean {
  return existsSync(join(tmpDir, path))
}

// ── New Generators ───────────────────────────────────────────────────────────

describe('make:mail', () => {
  test('creates mailable class', async () => {
    const cmd = new MakeMailCommand()
    await cmd.handle(args('WelcomeEmail'))
    expect(fileExists('app/Mail/WelcomeEmail.ts')).toBe(true)
    const content = readFile('app/Mail/WelcomeEmail.ts')
    expect(content).toContain("import { Mailable } from '@mantiq/mail'")
    expect(content).toContain('class WelcomeEmail extends Mailable')
    expect(content).toContain('override build()')
    expect(content).toContain('setSubject')
  })

  test('converts name to PascalCase', async () => {
    const cmd = new MakeMailCommand()
    await cmd.handle(args('order-shipped'))
    expect(fileExists('app/Mail/OrderShipped.ts')).toBe(true)
  })

  test('does not overwrite existing file', async () => {
    const cmd = new MakeMailCommand()
    await cmd.handle(args('Test'))
    const code = await cmd.handle(args('Test'))
    expect(code).toBe(1)
  })
})

describe('make:notification', () => {
  test('creates notification class', async () => {
    const cmd = new MakeNotificationCommand()
    await cmd.handle(args('InvoicePaid'))
    expect(fileExists('app/Notifications/InvoicePaid.ts')).toBe(true)
    const content = readFile('app/Notifications/InvoicePaid.ts')
    expect(content).toContain("import { Notification } from '@mantiq/notify'")
    expect(content).toContain('class InvoicePaid extends Notification')
    expect(content).toContain('override via(')
    expect(content).toContain("'mail', 'database'")
    expect(content).toContain('override toMail(')
    expect(content).toContain('override toDatabase(')
  })
})

describe('make:job', () => {
  test('creates job class', async () => {
    const cmd = new MakeJobCommand()
    await cmd.handle(args('ProcessPayment'))
    expect(fileExists('app/Jobs/ProcessPayment.ts')).toBe(true)
    const content = readFile('app/Jobs/ProcessPayment.ts')
    expect(content).toContain("import { Job } from '@mantiq/queue'")
    expect(content).toContain('class ProcessPayment extends Job')
    expect(content).toContain('override tries = 3')
    expect(content).toContain('override async handle()')
    expect(content).toContain('override async failed(error: Error)')
  })
})

describe('make:policy', () => {
  test('creates policy class', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle(args('Post'))
    expect(fileExists('app/Policies/PostPolicy.ts')).toBe(true)
    const content = readFile('app/Policies/PostPolicy.ts')
    expect(content).toContain("import { Policy } from '@mantiq/auth'")
    expect(content).toContain('class PostPolicy extends Policy')
    expect(content).toContain('view(user: any, post: Post)')
    expect(content).toContain('create(user: any)')
    expect(content).toContain('update(user: any, post: Post)')
    expect(content).toContain('delete(user: any, post: Post)')
  })

  test('uses --model flag for model name', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle(args('Comment', { model: 'BlogComment' }))
    const content = readFile('app/Policies/CommentPolicy.ts')
    expect(content).toContain("import { BlogComment } from '../Models/BlogComment.ts'")
    expect(content).toContain('blogcomment: BlogComment')
  })

  test('strips Policy suffix from name', async () => {
    const cmd = new MakePolicyCommand()
    await cmd.handle(args('PostPolicy'))
    expect(fileExists('app/Policies/PostPolicy.ts')).toBe(true)
    const content = readFile('app/Policies/PostPolicy.ts')
    expect(content).toContain('class PostPolicy extends Policy')
  })
})

// ── Previously Untested Generators ───────────────────────────────────────────

describe('make:event', () => {
  test('creates event class', async () => {
    const cmd = new MakeEventCommand()
    await cmd.handle(args('OrderPlaced'))
    expect(fileExists('app/Events/OrderPlaced.ts')).toBe(true)
    const content = readFile('app/Events/OrderPlaced.ts')
    expect(content).toContain('class OrderPlaced')
  })
})

describe('make:listener', () => {
  test('creates listener class', async () => {
    const cmd = new MakeListenerCommand()
    await cmd.handle(args('SendWelcomeEmail'))
    expect(fileExists('app/Listeners/SendWelcomeEmailListener.ts')).toBe(true)
    const content = readFile('app/Listeners/SendWelcomeEmailListener.ts')
    expect(content).toContain('class SendWelcomeEmailListener')
    expect(content).toContain('handle(')
  })

  test('with --event flag imports event', async () => {
    const cmd = new MakeListenerCommand()
    await cmd.handle(args('HandleOrder', { event: 'OrderPlaced' }))
    const content = readFile('app/Listeners/HandleOrderListener.ts')
    expect(content).toContain('OrderPlaced')
  })
})

describe('make:middleware', () => {
  test('creates middleware class', async () => {
    const cmd = new MakeMiddlewareCommand()
    await cmd.handle(args('EnsureAdmin'))
    expect(fileExists('app/Http/Middleware/EnsureAdminMiddleware.ts')).toBe(true)
    const content = readFile('app/Http/Middleware/EnsureAdminMiddleware.ts')
    expect(content).toContain('handle(')
    expect(content).toContain('next')
  })
})

describe('make:request', () => {
  test('creates form request class', async () => {
    const cmd = new MakeRequestCommand()
    await cmd.handle(args('StorePost'))
    expect(fileExists('app/Http/Requests/StorePostRequest.ts')).toBe(true)
    const content = readFile('app/Http/Requests/StorePostRequest.ts')
    expect(content).toContain('FormRequest')
    expect(content).toContain('override authorize()')
    expect(content).toContain('override rules()')
  })
})

describe('make:provider', () => {
  test('creates service provider class', async () => {
    const cmd = new MakeProviderCommand()
    await cmd.handle(args('Payment'))
    expect(fileExists('app/Providers/PaymentServiceProvider.ts')).toBe(true)
    const content = readFile('app/Providers/PaymentServiceProvider.ts')
    expect(content).toContain('ServiceProvider')
    expect(content).toContain('override register()')
    expect(content).toContain('override async boot()')
  })
})

describe('make:observer', () => {
  test('creates observer class', async () => {
    const cmd = new MakeObserverCommand()
    await cmd.handle(args('User'))
    expect(fileExists('app/Observers/UserObserver.ts')).toBe(true)
    const content = readFile('app/Observers/UserObserver.ts')
    expect(content).toContain('class UserObserver')
  })

  test('with --model flag adds typed methods', async () => {
    const cmd = new MakeObserverCommand()
    await cmd.handle(args('Post', { model: 'Post' }))
    const content = readFile('app/Observers/PostObserver.ts')
    expect(content).toContain('Post')
  })
})

describe('make:exception', () => {
  test('creates exception class', async () => {
    const cmd = new MakeExceptionCommand()
    await cmd.handle(args('PaymentFailed'))
    expect(fileExists('app/Exceptions/PaymentFailedException.ts')).toBe(true)
    const content = readFile('app/Exceptions/PaymentFailedException.ts')
    expect(content).toContain('class PaymentFailedException')
  })
})

describe('make:seeder', () => {
  test('creates seeder class', async () => {
    const cmd = new MakeSeederCommand()
    await cmd.handle(args('Product'))
    expect(fileExists('database/seeders/ProductSeeder.ts')).toBe(true)
    const content = readFile('database/seeders/ProductSeeder.ts')
    expect(content).toContain('Seeder')
    expect(content).toContain('override async run()')
  })
})

describe('make:factory', () => {
  test('creates factory class', async () => {
    const cmd = new MakeFactoryCommand()
    await cmd.handle(args('Product'))
    expect(fileExists('database/factories/ProductFactory.ts')).toBe(true)
    const content = readFile('database/factories/ProductFactory.ts')
    expect(content).toContain('Factory')
    expect(content).toContain('override definition(')
  })
})

describe('make:command', () => {
  test('creates command class', async () => {
    const cmd = new MakeCommandCommand()
    await cmd.handle(args('SendReport'))
    expect(fileExists('app/Console/Commands/SendReportCommand.ts')).toBe(true)
    const content = readFile('app/Console/Commands/SendReportCommand.ts')
    expect(content).toContain('Command')
    expect(content).toContain('override name')
    expect(content).toContain('override async handle(')
  })
})

describe('make:rule', () => {
  test('creates validation rule', async () => {
    const cmd = new MakeRuleCommand()
    await cmd.handle(args('Uppercase'))
    expect(fileExists('app/Rules/UppercaseRule.ts')).toBe(true)
    const content = readFile('app/Rules/UppercaseRule.ts')
    expect(content).toContain('uppercase')
  })
})

describe('make:test', () => {
  test('creates test file', async () => {
    const cmd = new MakeTestCommand()
    await cmd.handle(args('Payment'))
    expect(fileExists('tests/feature/Payment.test.ts')).toBe(true)
  })

  test('--unit creates unit test', async () => {
    const cmd = new MakeTestCommand()
    await cmd.handle(args('Calculator', { unit: true }))
    expect(fileExists('tests/unit/Calculator.test.ts')).toBe(true)
  })
})
