export class RealtimeError extends Error {
  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message)
    this.name = 'RealtimeError'
  }
}
