import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class MailSection implements RuleSection {
  readonly id = 'mail'
  readonly title = 'Mail (@mantiq/mail)'
  readonly requires = ['mail']

  render(_packages: DetectedPackage[]): string {
    return `- Mailables go in \`app/Mail/\`, extend \`Mailable\` from \`@mantiq/mail\`
- Override \`build()\` — use \`this.setSubject()\`, \`this.html()\`, \`this.text()\`
- Send: \`await mail.to('user@example.com').send(new WelcomeMail())\`
- Drivers: \`smtp\`, \`mailgun\`, \`ses\`, \`log\``
  }
}
