import { SQLiteConnection } from '@mantiq/database'
import { CreateHeartbeatTables } from '../src/migrations/CreateHeartbeatTables.ts'
import { Heartbeat } from '../src/Heartbeat.ts'
import { HeartbeatStore } from '../src/storage/HeartbeatStore.ts'
import { DEFAULT_CONFIG } from '../src/contracts/HeartbeatConfig.ts'
import type { HeartbeatConfig } from '../src/contracts/HeartbeatConfig.ts'
import type { DatabaseConnection } from '@mantiq/database'

/**
 * Create a test HeartbeatStore backed by an in-memory SQLite connection.
 * Runs the migration automatically.
 */
export async function createTestStore(): Promise<{ store: HeartbeatStore; connection: DatabaseConnection }> {
  const connection = new SQLiteConnection({ database: ':memory:' })
  const migration = new CreateHeartbeatTables()
  await migration.up(connection.schema(), connection)

  const store = new HeartbeatStore(connection)
  store.setupModels()
  return { store, connection }
}

/**
 * Create a test Heartbeat instance backed by an in-memory SQLite connection.
 */
export async function createTestHeartbeat(
  configOverrides?: Partial<HeartbeatConfig>,
): Promise<{ heartbeat: Heartbeat; connection: DatabaseConnection }> {
  const config = { ...DEFAULT_CONFIG, ...configOverrides } as HeartbeatConfig
  const connection = new SQLiteConnection({ database: ':memory:' })
  const migration = new CreateHeartbeatTables()
  await migration.up(connection.schema(), connection)

  const heartbeat = new Heartbeat(config, connection)
  return { heartbeat, connection }
}
