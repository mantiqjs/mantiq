// Optional peer dependencies — ambient module declarations for dynamic imports
declare module 'pg' {
  const pg: any
  export default pg
}

declare module 'mysql2/promise' {
  const mysql: any
  export default mysql
  export function createPool(config: any): any
}

declare module 'mssql' {
  const mssql: any
  export default mssql
}

declare module 'mongodb' {
  export const MongoClient: any
  export const ObjectId: any
}
