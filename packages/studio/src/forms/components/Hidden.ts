import { FormComponent } from '../contracts/FormComponent.ts'

export class Hidden extends FormComponent {
  static make(name: string): Hidden {
    return new Hidden(name)
  }

  override type(): string {
    return 'hidden'
  }
}
