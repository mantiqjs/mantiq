export interface Serializable {
  toSchema(): Record<string, unknown>
}
