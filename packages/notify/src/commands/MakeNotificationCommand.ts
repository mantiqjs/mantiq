import { GeneratorCommand } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'

export class MakeNotificationCommand extends GeneratorCommand {
  override name = 'make:notification'
  override description = 'Create a new notification class'
  override usage = 'make:notification <name>'

  override directory() { return 'app/Notifications' }
  override suffix() { return '' }

  override stub(name: string, _args: ParsedArgs): string {
    const className = name

    return `import { Notification } from '@mantiq/notify'
import type { Notifiable } from '@mantiq/notify'
import type { Mailable } from '@mantiq/mail'

export class ${className} extends Notification {
  constructor(private data: Record<string, any> = {}) { super() }

  via(notifiable: Notifiable): string[] {
    return ['mail', 'database']
  }

  toMail(notifiable: Notifiable): Mailable {
    // Return a Mailable instance
    // Example: return new ${className}Email(this.data)
    throw new Error('toMail() not implemented — create a mailable or use markdown')
  }

  toDatabase(notifiable: Notifiable): Record<string, any> {
    return {
      type: '${className}',
      ...this.data,
    }
  }
}
`
  }
}
