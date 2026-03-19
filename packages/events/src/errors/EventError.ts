import { MantiqError } from '@mantiq/core'

export class EventError extends MantiqError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
    this.name = 'EventError'
  }
}

export class ListenerError extends MantiqError {
  constructor(
    public readonly eventName: string,
    public readonly listenerName: string,
    public override readonly cause?: Error,
  ) {
    super(`Listener "${listenerName}" failed while handling "${eventName}": ${cause?.message ?? 'unknown error'}`, {
      event: eventName,
      listener: listenerName,
    })
    this.name = 'ListenerError'
  }
}

export class BroadcastError extends MantiqError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
    this.name = 'BroadcastError'
  }
}
