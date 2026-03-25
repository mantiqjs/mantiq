import { Model } from '@mantiq/database'

export class RoomMember extends Model {
  static override table = 'room_members'
  static override fillable = ['room_id', 'user_id', 'role', 'joined_at', 'muted']
  static override guarded = ['id']
  static override timestamps = false
}
