import type { ComponentType } from 'react'

// Form components
import { TextInput } from '@/components/forms/TextInput'
import { Textarea } from '@/components/forms/Textarea'
import { Select } from '@/components/forms/Select'
import { Toggle } from '@/components/forms/Toggle'
import { Checkbox } from '@/components/forms/Checkbox'
import { Radio } from '@/components/forms/Radio'
import { DatePicker } from '@/components/forms/DatePicker'
import { ColorPicker } from '@/components/forms/ColorPicker'
import { TagsInput } from '@/components/forms/TagsInput'
import { FileUpload } from '@/components/forms/FileUpload'
import { Repeater } from '@/components/forms/Repeater'
import { KeyValue } from '@/components/forms/KeyValue'

// Layout components
import { Section } from '@/components/forms/Section'
import { TabsLayout } from '@/components/forms/TabsLayout'
import { GridLayout } from '@/components/forms/GridLayout'
import { WizardLayout } from '@/components/forms/WizardLayout'

const registry: Record<string, ComponentType<any>> = {
  'text-input': TextInput,
  'textarea': Textarea,
  'select': Select,
  'toggle': Toggle,
  'checkbox': Checkbox,
  'radio': Radio,
  'date-picker': DatePicker,
  'color-picker': ColorPicker,
  'tags-input': TagsInput,
  'file-upload': FileUpload,
  'repeater': Repeater,
  'key-value': KeyValue,
  'section': Section,
  'tabs': TabsLayout,
  'grid': GridLayout,
  'wizard': WizardLayout,
}

export function registerComponent(type: string, component: ComponentType<any>): void {
  registry[type] = component
}

export function resolveComponent(type: string): ComponentType<any> | null {
  return registry[type] ?? null
}
