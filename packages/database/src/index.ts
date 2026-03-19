// ── Contracts ────────────────────────────────────────────────────────────────
export type { DatabaseConnection } from './contracts/Connection.ts'
export type { Grammar } from './contracts/Grammar.ts'
export type { PaginationResult } from './contracts/Paginator.ts'
export type {
  MongoDatabaseConnection,
  MongoCollectionContract,
  MongoQueryBuilder,
  MongoFilter,
  MongoUpdateDoc,
  MongoPipelineStage,
  MongoSortDoc,
  MongoProjection,
  MongoInsertResult,
  MongoInsertManyResult,
  MongoUpdateResult,
  MongoDeleteResult,
} from './contracts/MongoConnection.ts'

// ── Errors ────────────────────────────────────────────────────────────────────
export { QueryError } from './errors/QueryError.ts'
export { ModelNotFoundError } from './errors/ModelNotFoundError.ts'
export { ConnectionError } from './errors/ConnectionError.ts'

// ── Query Builder ─────────────────────────────────────────────────────────────
export { QueryBuilder } from './query/Builder.ts'
export { Expression, raw } from './query/Expression.ts'
export type { QueryState, WhereClause, JoinClause, OrderClause, Operator } from './query/Builder.ts'

// ── Grammar ───────────────────────────────────────────────────────────────────
export { BaseGrammar } from './drivers/BaseGrammar.ts'
export { SQLiteGrammar } from './drivers/SQLiteGrammar.ts'
export { PostgresGrammar } from './drivers/PostgresGrammar.ts'
export { MySQLGrammar } from './drivers/MySQLGrammar.ts'
export { MSSQLGrammar } from './drivers/MSSQLGrammar.ts'

// ── SQL Connections ───────────────────────────────────────────────────────────
export { SQLiteConnection } from './drivers/SQLiteConnection.ts'
export type { SQLiteConfig } from './drivers/SQLiteConnection.ts'
export { PostgresConnection } from './drivers/PostgresConnection.ts'
export type { PostgresConfig } from './drivers/PostgresConnection.ts'
export { MySQLConnection } from './drivers/MySQLConnection.ts'
export type { MySQLConfig } from './drivers/MySQLConnection.ts'
export { MSSQLConnection } from './drivers/MSSQLConnection.ts'
export type { MSSQLConfig } from './drivers/MSSQLConnection.ts'

// ── MongoDB ───────────────────────────────────────────────────────────────────
export { MongoConnection } from './drivers/MongoConnection.ts'
export type { MongoConfig } from './drivers/MongoConnection.ts'

// ── Schema Builder ────────────────────────────────────────────────────────────
export type { SchemaBuilder } from './schema/SchemaBuilder.ts'
export { SchemaBuilderImpl } from './schema/SchemaBuilder.ts'
export { Blueprint } from './schema/Blueprint.ts'
export { ColumnDefinition } from './schema/ColumnDefinition.ts'
export type { IndexDefinition, ForeignKeyDefinition } from './schema/Blueprint.ts'

// ── Migrations ────────────────────────────────────────────────────────────────
export { Migration } from './migrations/Migration.ts'
export type { MigrationContract } from './migrations/Migration.ts'
export { Migrator } from './migrations/Migrator.ts'
export type { MigrationFile } from './migrations/Migrator.ts'
export { MigrationRepository } from './migrations/MigrationRepository.ts'

// ── ORM ───────────────────────────────────────────────────────────────────────
export { Model } from './orm/Model.ts'
export type { Scope } from './orm/Scope.ts'
export { ClosureScope } from './orm/Scope.ts'
export {
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
} from './orm/Model.ts'
export type { ModelStatic } from './orm/Model.ts'
export { ModelQueryBuilder } from './orm/ModelQueryBuilder.ts'
export { Collection } from './orm/Collection.ts'

// ── MongoDB Document ORM ──────────────────────────────────────────────────────
export { Document } from './orm/Document.ts'

// ── Seeders & Factories ───────────────────────────────────────────────────────
export { Seeder } from './seeders/Seeder.ts'
export { Factory } from './factories/Factory.ts'
export { Faker } from './factories/Faker.ts'

// ── Database Manager ──────────────────────────────────────────────────────────
export { DatabaseManager } from './DatabaseManager.ts'
export type { DatabaseConfig, ConnectionConfig, SQLConfig } from './DatabaseManager.ts'
export type { MongoConfig as MongoConnectionConfig } from './DatabaseManager.ts'

// ── Bootstrap helpers ─────────────────────────────────────────────────────────
export { createDatabaseManager, setupModels } from './DatabaseServiceProvider.ts'

// ── Events ───────────────────────────────────────────────────────────────────
export { QueryExecuted, TransactionBeginning, TransactionCommitted, TransactionRolledBack } from './events/DatabaseEvents.ts'
export { MigrationStarted, MigrationEnded, MigrationsStarted, MigrationsEnded } from './events/DatabaseEvents.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────
export { db, table, schema, mongo, collection, setManager, getManager } from './helpers/db.ts'
