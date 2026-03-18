import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'
import type { DatabaseConnection } from '../contracts/Connection.ts'

export interface MigrationContract {
  up(schema: SchemaBuilder, db: DatabaseConnection): Promise<void>
  down(schema: SchemaBuilder, db: DatabaseConnection): Promise<void>
}

export abstract class Migration implements MigrationContract {
  abstract up(schema: SchemaBuilder, db: DatabaseConnection): Promise<void>
  abstract down(schema: SchemaBuilder, db: DatabaseConnection): Promise<void>
}
