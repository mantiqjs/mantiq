import type { ComponentType } from 'react'

const registry: Record<string, ComponentType<any>> = {}

export function registerComponent(type: string, component: ComponentType<any>): void {
  registry[type] = component
}

export function resolveComponent(type: string): ComponentType<any> | null {
  return registry[type] ?? null
}

// ── Lazy pre-registration of built-in components ──────────────────────────────
// We import and register eagerly so resolveComponent() works synchronously.

async function registerBuiltins() {
  // Form components
  const { TextInput } = await import('@/components/forms/TextInput')
  const { Textarea } = await import('@/components/forms/Textarea')
  const { Select } = await import('@/components/forms/Select')
  const { Toggle } = await import('@/components/forms/Toggle')
  const { Checkbox } = await import('@/components/forms/Checkbox')
  const { Radio } = await import('@/components/forms/Radio')
  const { DatePicker } = await import('@/components/forms/DatePicker')
  const { ColorPicker } = await import('@/components/forms/ColorPicker')
  const { TagsInput } = await import('@/components/forms/TagsInput')
  const { FileUpload } = await import('@/components/forms/FileUpload')
  const { Repeater } = await import('@/components/forms/Repeater')
  const { KeyValue } = await import('@/components/forms/KeyValue')

  // Layout components
  const { Section } = await import('@/components/forms/Section')
  const { TabsLayout } = await import('@/components/forms/TabsLayout')
  const { GridLayout } = await import('@/components/forms/GridLayout')
  const { WizardLayout } = await import('@/components/forms/WizardLayout')

  registerComponent('text-input', TextInput)
  registerComponent('textarea', Textarea)
  registerComponent('select', Select)
  registerComponent('toggle', Toggle)
  registerComponent('checkbox', Checkbox)
  registerComponent('radio', Radio)
  registerComponent('date-picker', DatePicker)
  registerComponent('color-picker', ColorPicker)
  registerComponent('tags-input', TagsInput)
  registerComponent('file-upload', FileUpload)
  registerComponent('repeater', Repeater)
  registerComponent('key-value', KeyValue)
  registerComponent('section', Section)
  registerComponent('tabs', TabsLayout)
  registerComponent('grid', GridLayout)
  registerComponent('wizard', WizardLayout)
}

// Kick off registration immediately
const builtinsReady = registerBuiltins()

/**
 * Wait for all built-in components to be registered.
 * Call this once at app startup before rendering any schemas.
 */
export function ensureBuiltins(): Promise<void> {
  return builtinsReady
}
