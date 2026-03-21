export class DriverNotSupportedError extends Error {
  constructor(driver: string, feature: string) {
    super(`"${feature}" is not supported by the ${driver} driver.`)
    this.name = 'DriverNotSupportedError'
  }
}
