import { env } from '@mantiq/core'

/**
 * Database Configuration
 *
 * Define your database connections here. The default connection is used
 * by the query builder, ORM, migrations, and seeders.
 *
 * Supported drivers: 'sqlite', 'postgres', 'mysql', 'mssql', 'mongodb'
 */
export default {
  // Default connection name — must match a key in connections below
  default: env('DB_CONNECTION', 'sqlite'),

  connections: {
    sqlite: {
      driver: 'sqlite' as const,
      // Path to the SQLite file — created automatically on first use
      database: env('DB_DATABASE', import.meta.dir + '/../database/database.sqlite'),
    },

    // postgres: {
    //   driver: 'postgres' as const,
    //   host: env('DB_HOST', '127.0.0.1'),
    //   port: Number(env('DB_PORT', '5432')),
    //   database: env('DB_DATABASE', 'mantiq'),
    //   username: env('DB_USERNAME', 'postgres'),
    //   password: env('DB_PASSWORD', ''),
    // },

    // mysql: {
    //   driver: 'mysql' as const,
    //   host: env('DB_HOST', '127.0.0.1'),
    //   port: Number(env('DB_PORT', '3306')),
    //   database: env('DB_DATABASE', 'mantiq'),
    //   username: env('DB_USERNAME', 'root'),
    //   password: env('DB_PASSWORD', ''),
    // },
  },
}
