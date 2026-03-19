import { ServiceProvider, ConfigRepository, CacheManager, RouterImpl } from '@mantiq/core'
import { Dispatcher } from './Dispatcher.ts'
import { BroadcastManager } from './broadcast/BroadcastManager.ts'
import type { BroadcastConfig } from './broadcast/BroadcastManager.ts'
import { EVENT_DISPATCHER } from './helpers/emit.ts'
import { BROADCAST_MANAGER } from './helpers/broadcast.ts'
import { fireModelEvent, bootModelEvents } from './model/HasEvents.ts'

const DEFAULT_BROADCAST_CONFIG: BroadcastConfig = {
  default: 'null',
  connections: {
    null: { driver: 'null' },
  },
}

/**
 * Registers the event dispatcher and broadcast manager in the container.
 *
 * Also hooks events into other framework packages when they are installed:
 * - @mantiq/database — Model lifecycle events, query events, migration events
 * - @mantiq/auth — Authentication events (Login, Logout, Failed, etc.)
 * - @mantiq/core — Cache events, RouteMatched event
 */
export class EventServiceProvider extends ServiceProvider {
  override register(): void {
    // Register the event dispatcher as a singleton
    this.app.singleton(Dispatcher, () => new Dispatcher())
    this.app.alias(Dispatcher, EVENT_DISPATCHER)

    // Register the broadcast manager as a singleton
    this.app.singleton(BroadcastManager, (c) => {
      let config = DEFAULT_BROADCAST_CONFIG
      try {
        config = c.make(ConfigRepository).get<BroadcastConfig>('broadcasting', DEFAULT_BROADCAST_CONFIG)
      } catch {
        // ConfigRepository not yet registered — use defaults
      }
      return new BroadcastManager(config)
    })
    this.app.alias(BroadcastManager, BROADCAST_MANAGER)
  }

  override boot(): void {
    const dispatcher = this.app.make<Dispatcher>(EVENT_DISPATCHER)
    const broadcaster = this.app.make<BroadcastManager>(BROADCAST_MANAGER)
    dispatcher.setBroadcaster(broadcaster)

    // ── Hook into @mantiq/database ─────────────────────────────────────
    try {
      const db = require('@mantiq/database') as any
      if (db.Model) {
        db.Model._fireEvent = fireModelEvent
        bootModelEvents(db.Model)
      }
      if (db.SQLiteConnection) {
        db.SQLiteConnection._dispatcher = dispatcher
      }
      if (db.Migrator) {
        db.Migrator._dispatcher = dispatcher
      }
    } catch {
      // @mantiq/database not installed
    }

    // ── Hook into @mantiq/auth ─────────────────────────────────────────
    try {
      const auth = require('@mantiq/auth') as any
      if (auth.SessionGuard) {
        auth.SessionGuard._dispatcher = dispatcher
      }
    } catch {
      // @mantiq/auth not installed
    }

    // ── Hook into @mantiq/core (cache + routing) ────────────────────────
    CacheManager._dispatcher = dispatcher
    RouterImpl._dispatcher = dispatcher
  }
}
