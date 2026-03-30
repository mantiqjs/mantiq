/**
 * Side-effect module that registers all built-in form components.
 * Import this file once at app startup — it has no exports.
 * Separated from registry.ts to avoid circular imports.
 */
import { registerComponent } from '@/components/registry'

// Form components — imported here, not in registry.ts
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
