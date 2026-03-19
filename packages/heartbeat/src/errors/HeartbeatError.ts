export class HeartbeatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'HeartbeatError'
  }
}
