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
  | additional connections for PostgreSQL, MySQL, MSSQL, or MongoDB.
  |
  | Supported drivers: 'sqlite', 'postgres', 'mysql', 'mssql', 'mongodb'
  |
  */
  connections: {
    sqlite: {
      driver: 'sqlite' as const,
      // ':memory:' for in-memory, or a file path
      database: env('DB_DATABASE', import.meta.dir + '/../database/database.sqlite'),
    },

    // postgres: {
    //   driver: 'postgres' as const,
    //   host: env('DB_HOST', '127.0.0.1'),
    //   port: Number(env('DB_PORT', '5432')),
    //   database: env('DB_DATABASE', 'mantiq'),
    //   user: env('DB_USERNAME', 'postgres'),
    //   password: env('DB_PASSWORD', ''),
    //   ssl: env('DB_SSL', 'false') === 'true',
    //   pool: {
    //     min: Number(env('DB_POOL_MIN', '2')),
    //     max: Number(env('DB_POOL_MAX', '10')),
    //   },
    //   // Read/write splitting — route reads to replicas
    //   // read: {
    //   //   host: [env('DB_READ_HOST_1', '127.0.0.1'), env('DB_READ_HOST_2', '127.0.0.1')],
    //   // },
    //   // write: {
    //   //   host: env('DB_WRITE_HOST', '127.0.0.1'),
    //   // },
    // },

    // mysql: {
    //   driver: 'mysql' as const,
    //   host: env('DB_HOST', '127.0.0.1'),
    //   port: Number(env('DB_PORT', '3306')),
    //   database: env('DB_DATABASE', 'mantiq'),
    //   user: env('DB_USERNAME', 'root'),
    //   password: env('DB_PASSWORD', ''),
    //   pool: {
    //     min: Number(env('DB_POOL_MIN', '2')),
    //     max: Number(env('DB_POOL_MAX', '10')),
    //   },
    //   // Read/write splitting — route reads to replicas
    //   // read: {
    //   //   host: [env('DB_READ_HOST_1', '127.0.0.1'), env('DB_READ_HOST_2', '127.0.0.1')],
    //   // },
    //   // write: {
    //   //   host: env('DB_WRITE_HOST', '127.0.0.1'),
    //   // },
    // },

    // mariadb: {
    //   driver: 'mysql' as const,  // MariaDB uses the MySQL driver
    //   host: env('DB_HOST', '127.0.0.1'),
    //   port: Number(env('DB_PORT', '3306')),
    //   database: env('DB_DATABASE', 'mantiq'),
    //   user: env('DB_USERNAME', 'root'),
    //   password: env('DB_PASSWORD', ''),
    //   pool: {
    //     min: Number(env('DB_POOL_MIN', '2')),
    //     max: Number(env('DB_POOL_MAX', '10')),
    //   },
    //   // read: { host: [env('DB_READ_HOST_1', '127.0.0.1')] },
    //   // write: { host: env('DB_WRITE_HOST', '127.0.0.1') },
    // },

    // mssql: {
    //   driver: 'mssql' as const,
    //   host: env('DB_HOST', '127.0.0.1'),
    //   port: Number(env('DB_PORT', '1433')),
    //   database: env('DB_DATABASE', 'mantiq'),
    //   user: env('DB_USERNAME', 'sa'),
    //   password: env('DB_PASSWORD', ''),
    //   encrypt: env('DB_ENCRYPT', 'true') === 'true',
    //   trustServerCertificate: env('DB_TRUST_CERT', 'false') === 'true',
    //   pool: {
    //     min: Number(env('DB_POOL_MIN', '2')),
    //     max: Number(env('DB_POOL_MAX', '10')),
    //   },
    //   // read: { host: [env('DB_READ_HOST_1', '127.0.0.1')] },
    //   // write: { host: env('DB_WRITE_HOST', '127.0.0.1') },
    // },

    // mongodb: {
    //   driver: 'mongodb' as const,
    //   uri: env('MONGODB_URL', 'mongodb://127.0.0.1:27017'),
    //   database: env('DB_DATABASE', 'mantiq'),
    //   options: {
    //     // Any MongoClient options: retryWrites, w, etc.
    //   },
    //   // Read preference for replicas
    //   // readPreference: 'secondaryPreferred',
    // },
  },
}
