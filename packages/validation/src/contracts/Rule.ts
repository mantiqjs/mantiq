/**
 * Context passed to rules during validation — gives access to the
 * validator instance and optional database presence verifier.
 */
export interface ValidationContext {
  validator: any
  presenceVerifier: any | null
}

/**
 * A validation rule that can check a single field value.
 */
export interface Rule {
  /** Rule name (e.g. 'required', 'min', 'email') */
  readonly name: string

  /**
   * Validate the value.
   * @returns true if valid, or a string error message if invalid.
   */
  validate(
    value: any,
    field: string,
    data: Record<string, any>,
    params: string[],
    context?: ValidationContext,
  ): boolean | string | Promise<boolean | string>
}
