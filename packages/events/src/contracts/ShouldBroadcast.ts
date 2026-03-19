/**
 * Implement this interface on an Event class to mark it as broadcastable.
 *
 * When the event is dispatched via `emit()`, the broadcast manager
 * will push the event data to all clients subscribed to the channels
 * returned by `broadcastOn()`.
 *
 * ```typescript
 * class OrderShipped extends Event implements ShouldBroadcast {
 *   constructor(public order: Order) { super() }
 *
 *   broadcastOn() {
 *     return ['private:orders.' + this.order.id]
 *   }
 *
 *   broadcastWith() {
 *     return { orderId: this.order.id, status: 'shipped' }
 *   }
 * }
 * ```
 */
export interface ShouldBroadcast {
  /**
   * The channel(s) the event should broadcast on.
   */
  broadcastOn(): string | string[]

  /**
   * Custom event name for the broadcast. Defaults to the class name.
   */
  broadcastAs?(): string

  /**
   * Custom payload for the broadcast. Defaults to all public properties.
   */
  broadcastWith?(): Record<string, any>
}

/**
 * Implement this interface to broadcast synchronously (skip the queue).
 * Identical to ShouldBroadcast but signals the system to bypass queuing.
 */
export interface ShouldBroadcastNow extends ShouldBroadcast {}
