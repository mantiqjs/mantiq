import { ServiceProvider } from '@mantiq/core'

export class AppServiceProvider extends ServiceProvider {
  override register(): void {}
  override async boot(): Promise<void> {}
}
