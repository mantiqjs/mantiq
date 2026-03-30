import { FormComponent } from '../contracts/FormComponent.ts'

export class FileUpload extends FormComponent {
  protected _accept: string | undefined = undefined
  protected _maxSize: number | undefined = undefined
  protected _multiple: boolean = false
  protected _disk: string | undefined = undefined
  protected _directory: string | undefined = undefined
  protected _imagePreview: boolean = false

  static make(name: string): FileUpload {
    return new FileUpload(name)
  }

  override type(): string {
    return 'file-upload'
  }

  accept(accept: string): this {
    this._accept = accept
    return this
  }

  maxSize(size: number): this {
    this._maxSize = size
    return this
  }

  multiple(multiple: boolean = true): this {
    this._multiple = multiple
    return this
  }

  disk(disk: string): this {
    this._disk = disk
    return this
  }

  directory(directory: string): this {
    this._directory = directory
    return this
  }

  imagePreview(preview: boolean = true): this {
    this._imagePreview = preview
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      accept: this._accept,
      maxSize: this._maxSize,
      multiple: this._multiple,
      disk: this._disk,
      directory: this._directory,
      imagePreview: this._imagePreview,
    }
  }
}
