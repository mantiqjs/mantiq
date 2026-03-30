// ── Contracts ────────────────────────────────────────────────────────────────
export type { Serializable } from './contracts/Serializable.ts'
export type { PanelConfig, ColorConfig, SidebarConfig } from './contracts/StudioConfig.ts'
export { defaultPanelConfig } from './contracts/StudioConfig.ts'

// ── Forms: Contracts ─────────────────────────────────────────────────────────
export { FormComponent } from './forms/contracts/FormComponent.ts'

// ── Forms: Components ────────────────────────────────────────────────────────
export { TextInput } from './forms/components/TextInput.ts'
export type { TextInputType } from './forms/components/TextInput.ts'
export { Textarea } from './forms/components/Textarea.ts'
export { Select } from './forms/components/Select.ts'
export { Toggle } from './forms/components/Toggle.ts'
export { Checkbox } from './forms/components/Checkbox.ts'
export { DatePicker } from './forms/components/DatePicker.ts'
export { FileUpload } from './forms/components/FileUpload.ts'
export { Repeater } from './forms/components/Repeater.ts'
export { Hidden } from './forms/components/Hidden.ts'
export { Placeholder } from './forms/components/Placeholder.ts'
export { TagsInput } from './forms/components/TagsInput.ts'
export { KeyValue } from './forms/components/KeyValue.ts'
export { Radio } from './forms/components/Radio.ts'
export { CheckboxList } from './forms/components/CheckboxList.ts'
export { ColorPicker } from './forms/components/ColorPicker.ts'
export type { ColorFormat } from './forms/components/ColorPicker.ts'

// ── Forms: Layout ────────────────────────────────────────────────────────────
export { Section } from './forms/layout/Section.ts'
export { Tabs, Tab } from './forms/layout/Tabs.ts'
export type { TabSchema } from './forms/layout/Tabs.ts'
export { Grid } from './forms/layout/Grid.ts'
export { Wizard, WizardStep } from './forms/layout/Wizard.ts'
export { Card } from './forms/layout/Card.ts'
export { Fieldset } from './forms/layout/Fieldset.ts'

// ── Forms: Container ─────────────────────────────────────────────────────────
export { Form } from './forms/Form.ts'

// ── Tables: Contracts ────────────────────────────────────────────────────────
export { Column } from './tables/contracts/Column.ts'
export type { ColumnAlignment } from './tables/contracts/Column.ts'
export { Filter } from './tables/contracts/Filter.ts'

// ── Tables: Columns ──────────────────────────────────────────────────────────
export { TextColumn } from './tables/columns/TextColumn.ts'
export { BadgeColumn } from './tables/columns/BadgeColumn.ts'
export { BooleanColumn } from './tables/columns/BooleanColumn.ts'
export { ImageColumn } from './tables/columns/ImageColumn.ts'
export { IconColumn } from './tables/columns/IconColumn.ts'
export { ColorColumn } from './tables/columns/ColorColumn.ts'

// ── Tables: Filters ──────────────────────────────────────────────────────────
export { SelectFilter } from './tables/filters/SelectFilter.ts'
export { TernaryFilter } from './tables/filters/TernaryFilter.ts'
export { DateFilter } from './tables/filters/DateFilter.ts'

// ── Tables: Container ────────────────────────────────────────────────────────
export { Table } from './tables/Table.ts'
export type { SortDirection } from './tables/Table.ts'

// ── Actions ──────────────────────────────────────────────────────────────────
export { Action } from './actions/Action.ts'
export type { ActionResult, ConfirmationConfig } from './actions/Action.ts'
export { CreateAction } from './actions/CreateAction.ts'
export { EditAction } from './actions/EditAction.ts'
export { ViewAction } from './actions/ViewAction.ts'
export { DeleteAction } from './actions/DeleteAction.ts'
export { BulkAction } from './actions/BulkAction.ts'
export { BulkDeleteAction } from './actions/BulkDeleteAction.ts'

// ── Widgets ──────────────────────────────────────────────────────────────────
export { Widget } from './widgets/Widget.ts'
export { StatsWidget, Stat } from './widgets/StatsWidget.ts'
export type { StatTrend } from './widgets/StatsWidget.ts'
export { ChartWidget } from './widgets/ChartWidget.ts'
export type { ChartType, ChartDataset } from './widgets/ChartWidget.ts'
export { TableWidget } from './widgets/TableWidget.ts'

// ── Schema Types ──────────────────────────────────────────────────────────────
export type {
  FormComponentSchema,
  FormSchema,
  ColumnSchema,
  FilterSchema,
  TableSchema,
  ActionSchema,
  ActionResult as ActionResultSchema,
  StatSchema,
  WidgetSchema,
  NavigationItemSchema,
  NavigationGroupSchema,
  PanelSchema,
  ResourceSchema,
  PageSchema,
} from './schema/SchemaTypes.ts'

// ── Resources ─────────────────────────────────────────────────────────────────
export { Resource } from './resources/Resource.ts'

// ── Panel ─────────────────────────────────────────────────────────────────────
export { StudioPanel } from './StudioPanel.ts'
export { PanelManager } from './panel/PanelManager.ts'
export { PanelDiscovery } from './panel/PanelDiscovery.ts'

// ── Navigation ────────────────────────────────────────────────────────────────
export { NavigationBuilder } from './navigation/NavigationBuilder.ts'
export { NavigationGroup } from './navigation/NavigationGroup.ts'
export { NavigationItem } from './navigation/NavigationItem.ts'

// ── HTTP ──────────────────────────────────────────────────────────────────────
export { StudioController } from './http/StudioController.ts'

// ── Middleware ─────────────────────────────────────────────────────────────────
export { CheckPanelAccess } from './middleware/CheckPanelAccess.ts'
export { StudioServeAssets } from './middleware/StudioServeAssets.ts'

// ── Errors ────────────────────────────────────────────────────────────────────
export { StudioError } from './errors/StudioError.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────
export { studio, STUDIO } from './helpers/studio.ts'

// ── Service Provider ──────────────────────────────────────────────────────────
export { StudioServiceProvider } from './StudioServiceProvider.ts'

// ── Commands ──────────────────────────────────────────────────────────────────
export { MakeResourceCommand } from './commands/MakeResourceCommand.ts'
export { PublishFrontendCommand } from './commands/PublishFrontendCommand.ts'
