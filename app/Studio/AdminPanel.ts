import { StudioPanel } from '@mantiq/studio'

export class AdminPanel extends StudioPanel {
  override path = '/admin'
  override brandName = 'Admin'

  override resources() {
    // Import your resources here:
    // import { UserResource } from './Resources/UserResource.ts'
    // return [UserResource]
    return []
  }

  override colors() {
    return {
      primary: '#2563eb',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    }
  }
}
