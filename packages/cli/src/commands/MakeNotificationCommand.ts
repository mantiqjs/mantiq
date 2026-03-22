import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeNotificationCommand extends GeneratorCommand {
  override name = 'make:notification'
  override description = 'Create a new notification class'
  override usage = 'make:notification <name>'

  override directory() { return 'app/Notifications' }
  override suffix() { return '' }

  override stub(name: string): string {
    return `import { Notification } from '@mantiq/notify'
import type { Notifiable } from '@mantiq/notify'

export class ${name} extends Notification {
  constructor(private readonly data: Record<string, any> = {}) {
    super()
  }

  override via(notifiable: Notifiable): string[] {
    return ['mail', 'database']
  }

  override toMail(notifiable: Notifiable): any {
    return {
      subject: '${this.toSubject(name)}',
      html: '<p>${this.toSubject(name)}</p>',
    }
  }

  override toDatabase(notifiable: Notifiable): Record<string, any> {
    return {
      type: '${this.toSnake(name)}',
      ...this.data,
    }
  }
}
`
  }

  private toSubject(name: string): string {
    return name.replace(/([A-Z])/g, ' $1').trim()
  }

  private toSnake(name: string): string {
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
  }
}
