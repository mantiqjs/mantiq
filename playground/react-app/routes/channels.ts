/**
 * Broadcast Channels
 *
 * Define authorization callbacks for broadcast channels here.
 * Private and presence channels require authentication.
 *
 * @example
 *   import { broadcast } from '@mantiq/core'
 *
 *   // Private channel — only the owner can listen
 *   broadcast.channel('orders.{orderId}', (user, orderId) => {
 *     return user.id === Order.find(orderId)?.user_id
 *   })
 *
 *   // Presence channel — returns user info for member tracking
 *   broadcast.channel('chat.{roomId}', (user, roomId) => {
 *     return { id: user.id, name: user.name }
 *   })
 */

export default function () {
  // Define your broadcast channel authorization here
}
