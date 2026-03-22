import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Database Connection
  |--------------------------------------------------------------------------
  |
  | The database connection used by default for all database operations.
  | This corresponds to one of the connections defined below. You can
  | switch connections at runtime with db().connection('name').
  |
  */
  default: env('DB_CONNECTION', 'sqlite'),

  /*
  |--------------------------------------------------------------------------
  | Database Connections
  |--------------------------------------------------------------------------
  |
  | Here are each of the database connections set up for your application.
  | SQLite is pre-configured and requires no external services. Add
  | additional connections for PostgreSQL, MySQL, or MongoDB as needed.
  |
  | Supported drivers: 'sqlite', 'postgres', 'mysql', 'mssql', 'mongodb'
  |
  */
  connections: {
    sqlite: {
      driver: 'sqlite' as const,
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

    // mssql: {
    //   driver: 'mssql' as const,
    //   host: env('DB_HOST', '127.0.0.1'),
    //   port: Number(env('DB_PORT', '1433')),
    //   database: env('DB_DATABASE', 'mantiq'),
    //   username: env('DB_USERNAME', 'sa'),
    //   password: env('DB_PASSWORD', ''),
    // },

    // mongodb: {
    //   driver: 'mongodb' as const,
    //   url: env('MONGODB_URL', 'mongodb://127.0.0.1:27017'),
    //   database: env('DB_DATABASE', 'mantiq'),
    // },
  },
}
