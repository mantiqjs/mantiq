import type { Serializable } from '../contracts/Serializable.ts'
import type { FormComponent } from '../forms/contracts/FormComponent.ts'

export interface ActionResult {
  type: 'success' | 'failure' | 'redirect'
  message: string | undefined
  redirectUrl: string | undefined
}

export interface ConfirmationConfig {
  title: string
  description: string | undefined
  confirmLabel: string
  cancelLabel: string
}

export abstract class Action implements Serializable {
  protected _name: string
  protected _label: string | undefined = undefined
  protected _icon: string | undefined = undefined
  protected _color: string = 'primary'
  protected _requiresConfirmation: boolean = false
  protected _confirmation: ConfirmationConfig = {
    title: 'Are you sure?',
    description: undefined,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  }
  protected _modalForm: FormComponent[] = []
  protected _authorizationCallback: ((record: Record<string, unknown>) => boolean) | undefined = undefined
  protected _successNotification: string | undefined = undefined

  protected constructor(name: string) {
    this._name = name
  }

  abstract handle(record: Record<string, unknown>, data?: Record<string, unknown>): ActionResult | Promise<ActionResult>

  get name(): string {
    return this._name
  }

  label(label: string): this {
    this._label = label
    return this
  }

  icon(icon: string): this {
    this._icon = icon
    return this
  }

  color(color: string): this {
    this._color = color
    return this
  }

  requiresConfirmation(requires: boolean = true): this {
    this._requiresConfirmation = requires
    return this
  }

  confirmation(config: Partial<ConfirmationConfig>): this {
    this._confirmation = { ...this._confirmation, ...config }
    this._requiresConfirmation = true
    return this
  }

  modalForm(components: FormComponent[]): this {
    this._modalForm = components
    return this
  }

  authorize(callback: (record: Record<string, unknown>) => boolean): this {
    this._authorizationCallback = callback
    return this
  }

  successNotification(message: string): this {
    this._successNotification = message
    return this
  }

  isAuthorized(record: Record<string, unknown>): boolean {
    if (this._authorizationCallback === undefined) {
      return true
    }
    return this._authorizationCallback(record)
  }

  toSchema(): Record<string, unknown> {
    return {
      name: this._name,
      label: this._label,
      icon: this._icon,
      color: this._color,
      requiresConfirmation: this._requiresConfirmation,
      confirmation: this._requiresConfirmation ? this._confirmation : undefined,
      modalForm: this._modalForm.map((c) => c.toSchema()),
      successNotification: this._successNotification,
    }
  }
}
