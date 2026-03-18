import type { DatabaseConnection } from '../contracts/Connection.ts'

export abstract class Seeder {
  protected connection!: DatabaseConnection

  abstract run(): Promise<void>

  setConnection(connection: DatabaseConnection): this {
    this.connection = connection
    return this
  }

  protected async call(SeederClass: new () => Seeder): Promise<void> {
    const seeder = new SeederClass()
    seeder.setConnection(this.connection)
    await seeder.run()
  }

  protected async callMany(classes: (new () => Seeder)[]): Promise<void> {
    for (const cls of classes) {
      await this.call(cls)
    }
  }

  table(name: string) {
    return this.connection.table(name)
  }
}
