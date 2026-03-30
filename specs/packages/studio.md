# @mantiq/studio — Server-Driven UI Framework

## 1. Executive Summary

`@mantiq/studio` is a server-driven UI framework for building admin panels, CRUD interfaces, dashboards, and forms. The server defines UI structure using TypeScript builder classes that serialize to JSON schemas. A bundled React + shadcn/ui frontend fetches and renders them. **No frontend code is needed for standard admin panels.**

### Key Design Principle: Pluggable & Independent

Studio is **completely independent of the user's application frontend**. Whether the user chose React, Vue, Svelte, Vanilla, or has no frontend at all — Studio works identically. It ships its own self-contained React SPA (pre-built, served from the package's `frontend/dist/` directory) at a configurable path (default `/admin`). The user's app and Studio share only the backend — they never share frontend code, build tools, or dependencies.

This means:
- **No frontend setup required** — `bun add @mantiq/studio` is all you need
- **No Vite/React dependency in the user's project** — Studio's React app is pre-compiled
- **Isolated routing** — Studio's `/admin/*` routes are completely separate from the app's routes
- **Isolated auth** — Studio can use a different auth guard than the main app (e.g., `admin` guard vs `web` guard)
- **Works on headless APIs** — Even a pure JSON API project (no frontend kit) can add Studio for admin

This is architecturally divided into two halves:
- **Backend (`@mantiq/studio`)**: TypeScript builder classes (Resources, Forms, Tables, Widgets, Pages, Navigation, Actions) that run on Bun and serialize to JSON. Integrates with `@mantiq/core` (routing, middleware, container), `@mantiq/database` (ORM models, queries), `@mantiq/auth` (guards, policies), and `@mantiq/realtime` (WebSocket updates).
- **Frontend (bundled React SPA)**: A pre-built React app shipped inside the npm package. Uses shadcn/ui components, a component registry pattern, and communicates with the backend exclusively via JSON APIs. Served by `StudioServeAssets` middleware — no user-side build step.

---

### 2. Package Structure

```
packages/studio/
src/
  index.ts                              -- Public API exports
  StudioServiceProvider.ts              -- Registers all studio bindings
  StudioPanel.ts                        -- Abstract panel class (entry point)
  contracts/
    StudioConfig.ts                     -- StudioConfig, PanelConfig interfaces
    Serializable.ts                     -- interface Serializable { toSchema(): Record<string, any> }
    HasAuthorization.ts                 -- Policy/gate contract
  panel/
    PanelManager.ts                     -- Manages multiple panels, resolves active panel
    PanelRouteRegistrar.ts              -- Registers all panel routes (API + SPA catch-all)
  resources/
    Resource.ts                         -- Abstract Resource base class
    ResourceRouteRegistrar.ts           -- CRUD route generation for a resource
    pages/
      ListRecords.ts                    -- List page (table)
      CreateRecord.ts                   -- Create page (form)
      EditRecord.ts                     -- Edit page (form)
      ViewRecord.ts                     -- View page (infolist)
  forms/
    Form.ts                             -- Form container (holds components)
    contracts/
      FormComponent.ts                  -- Base interface for all form components
    components/
      TextInput.ts
      Textarea.ts
      RichEditor.ts
      Select.ts
      MultiSelect.ts
      Checkbox.ts
      CheckboxList.ts
      Toggle.ts
      Radio.ts
      DatePicker.ts
      TimePicker.ts
      DateTimePicker.ts
      ColorPicker.ts
      FileUpload.ts
      Repeater.ts
      KeyValue.ts
      TagsInput.ts
      Hidden.ts
      Placeholder.ts
    layout/
      Section.ts
      Tabs.ts
      Grid.ts
      Fieldset.ts
      Card.ts
      Wizard.ts
  tables/
    Table.ts                            -- Table container
    contracts/
      Column.ts                         -- Base interface for columns
      Filter.ts                         -- Base interface for filters
    columns/
      TextColumn.ts
      BadgeColumn.ts
      BooleanColumn.ts
      ImageColumn.ts
      IconColumn.ts
      ColorColumn.ts
    filters/
      SelectFilter.ts
      TernaryFilter.ts
      DateFilter.ts
      QueryFilter.ts
  infolists/
    Infolist.ts                         -- Read-only display container
    entries/
      TextEntry.ts
      BadgeEntry.ts
      BooleanEntry.ts
      ImageEntry.ts
      IconEntry.ts
      ColorEntry.ts
      KeyValueEntry.ts
  actions/
    Action.ts                           -- Base action class
    CreateAction.ts
    EditAction.ts
    DeleteAction.ts
    ViewAction.ts
    BulkAction.ts
    BulkDeleteAction.ts
  widgets/
    Widget.ts                           -- Base widget class
    StatsWidget.ts
    ChartWidget.ts
    TableWidget.ts
  navigation/
    NavigationBuilder.ts                -- Builds nav tree from resources
    NavigationGroup.ts
    NavigationItem.ts
  notifications/
    Notification.ts                     -- Server-sent notification
    DatabaseNotification.ts             -- Persisted notification
  pages/
    Page.ts                             -- Abstract custom page
    Dashboard.ts                        -- Default dashboard page
  schema/
    SchemaEncoder.ts                    -- Central toSchema() orchestrator
    SchemaTypes.ts                      -- TypeScript types for the JSON schema protocol
  http/
    StudioController.ts                 -- Handles all /admin/api/* routes
    SchemaController.ts                 -- GET /api/schema (nav, panel config)
    ResourceController.ts              -- CRUD endpoints for resources
    WidgetController.ts                 -- Widget data endpoints
    ActionController.ts                 -- Action execution endpoints
    NotificationController.ts          -- Notification endpoints
  middleware/
    StudioAuthenticate.ts               -- Ensure user can access studio
    StudioServeAssets.ts                -- Serve the bundled React app
  helpers/
    studio.ts                           -- studio() helper + STUDIO symbol
  errors/
    StudioError.ts                      -- Base error class
    ResourceNotFoundError.ts
    ActionAuthorizationError.ts
  testing/
    StudioFake.ts                       -- Test helpers for resources
frontend/                               -- React + shadcn/ui SPA (pre-built)
  dist/                                 -- Pre-built production assets
  src/
    main.tsx                            -- Entry point
    App.tsx                             -- Root component with routing
    api/
      client.ts                         -- API client (fetch wrapper)
      hooks.ts                          -- React Query hooks
    components/
      registry.ts                       -- Component registry mapping
      layout/
        PanelLayout.tsx                 -- Shell (sidebar, topbar, content)
        Sidebar.tsx
        Topbar.tsx
        Breadcrumbs.tsx
      forms/
        FormRenderer.tsx                -- Renders form schema
        TextInput.tsx                   -- ...one per form component
        Select.tsx
        ...
      tables/
        TableRenderer.tsx               -- Renders table schema
        DataTable.tsx
        Filters.tsx
        Pagination.tsx
        ...
      infolists/
        InfolistRenderer.tsx
        ...
      widgets/
        WidgetRenderer.tsx
        StatsWidget.tsx
        ChartWidget.tsx
        ...
      actions/
        ActionModal.tsx
        ConfirmationDialog.tsx
      pages/
        ListPage.tsx
        CreatePage.tsx
        EditPage.tsx
        ViewPage.tsx
        DashboardPage.tsx
        CustomPage.tsx
    theme/
      ThemeProvider.tsx                  -- Dark mode, custom colors
tests/
  unit/
    forms/
      TextInput.test.ts
      Select.test.ts
      Textarea.test.ts
      DatePicker.test.ts
      Repeater.test.ts
      Form.test.ts
      Section.test.ts
      Tabs.test.ts
      Wizard.test.ts
    tables/
      TextColumn.test.ts
      BadgeColumn.test.ts
      BooleanColumn.test.ts
      Table.test.ts
      SelectFilter.test.ts
      TernaryFilter.test.ts
    infolists/
      TextEntry.test.ts
      Infolist.test.ts
    actions/
      Action.test.ts
      DeleteAction.test.ts
      BulkDeleteAction.test.ts
    widgets/
      StatsWidget.test.ts
      ChartWidget.test.ts
    resources/
      Resource.test.ts
      ResourceRouteRegistrar.test.ts
    navigation/
      NavigationBuilder.test.ts
    schema/
      SchemaEncoder.test.ts
    panel/
      PanelManager.test.ts
  integration/
    resource-crud.spec.ts
    schema-api.spec.ts
    action-execution.spec.ts
    authorization.spec.ts
    widget-data.spec.ts
package.json
tsconfig.json
README.md
```

---

### 3. Core Contracts

#### 3.1 Serializable Interface

Every Studio component implements this contract. The `toSchema()` method returns a plain object that the JSON schema protocol consumes.

```typescript
interface Serializable {
  toSchema(): Record<string, any>
}
```

This is the fundamental abstraction. Form components, table columns, filters, actions, widgets, layout elements, pages -- everything serializes to a JSON-friendly object. The frontend component registry maps `type` strings to React components.

#### 3.2 StudioConfig

```typescript
interface StudioConfig {
  defaultPanel: string
  panels: Record<string, PanelConfig>
}

interface PanelConfig {
  path: string
  middleware: Constructor<Middleware>[]
  brandName: string
  brandLogo?: string
  favicon?: string
  darkMode: boolean
  colors: {
    primary: string
    danger: string
    warning: string
    success: string
    info: string
  }
  maxContentWidth: 'full' | '7xl' | '6xl' | '5xl'
  sidebarCollapsible: boolean
  topNavigation: boolean
  databaseNotifications: boolean
  globalSearch: boolean
  perPage: number
  defaultPaginationPageOption: number[]
}
```

#### 3.3 HasAuthorization

Resources and actions can define authorization policies.

```typescript
interface HasAuthorization {
  canViewAny(user: Authenticatable): Promise<boolean>
  canView(user: Authenticatable, record: Model): Promise<boolean>
  canCreate(user: Authenticatable): Promise<boolean>
  canUpdate(user: Authenticatable, record: Model): Promise<boolean>
  canDelete(user: Authenticatable, record: Model): Promise<boolean>
  canDeleteAny(user: Authenticatable): Promise<boolean>
  canForceDelete(user: Authenticatable, record: Model): Promise<boolean>
  canRestore(user: Authenticatable, record: Model): Promise<boolean>
}
```

---

### 4. StudioPanel (Entry Point)

```typescript
abstract class StudioPanel {
  path: string = '/admin'
  brandName: string = 'Studio'

  abstract resources(): Constructor<Resource>[]
  widgets(): Constructor<Widget>[] { return [] }
  pages(): Constructor<Page>[] { return [] }
  middleware(): Constructor<Middleware>[] { return [Authenticate] }

  navigationGroups(): NavigationGroup[] { return [] }
  colors(): Record<string, string> { return {} }

  darkMode(): boolean { return true }
  sidebarCollapsible(): boolean { return true }
  topNavigation(): boolean { return false }
  globalSearch(): boolean { return true }

  maxContentWidth(): 'full' | '7xl' | '6xl' | '5xl' { return '7xl' }

  /** Called during boot to register routes, resolve resources, etc. */
  boot(container: Container): void
}
```

The `StudioServiceProvider` reads the panel config, instantiates user-defined panels, and registers all necessary routes and middleware. The boot flow:

1. `register()` -- Bind `PanelManager` as singleton, bind `StudioController` and friends.
2. `boot()` -- Discover panels from config, call `panel.boot()` for each, register routes via `PanelRouteRegistrar`.

---

### 5. Resource System

#### 5.1 Abstract Resource

```typescript
abstract class Resource implements Serializable {
  static model: ModelStatic<any>
  static navigationIcon: string = 'file'
  static navigationGroup: string = ''
  static navigationSort: number = 0
  static navigationLabel: string = ''           // defaults to pluralized model name
  static navigationBadge: (() => Promise<number | string | null>) | null = null
  static slug: string = ''                      // defaults to kebab-case model name
  static recordTitleAttribute: string = 'id'    // used in breadcrumbs and relation labels
  static globallySearchable: boolean = true
  static defaultSort: string = 'id'
  static defaultSortDirection: 'asc' | 'desc' = 'desc'

  // -- CRUD Definitions -------------------------------------------------------

  abstract form(): Form
  abstract table(): Table

  /** Infolist for view page. Defaults to form fields rendered read-only. */
  infolist(): Infolist | null { return null }

  /** Widgets displayed above the table on the list page */
  headerWidgets(): Widget[] { return [] }

  /** Widgets displayed below the table on the list page */
  footerWidgets(): Widget[] { return [] }

  // -- Pages ------------------------------------------------------------------

  /** Override to add custom pages to this resource. */
  pages(): Record<string, Constructor<Page>> {
    return {
      'index': ListRecords,
      'create': CreateRecord,
      'edit': EditRecord,
      'view': ViewRecord,
    }
  }

  // -- Query Scoping ----------------------------------------------------------

  /** Modify the base Eloquent query for this resource (e.g., tenant scoping). */
  modifyQuery(query: ModelQueryBuilder<any>): ModelQueryBuilder<any> {
    return query
  }

  /** Eager-load relations for list queries. */
  eagerLoad(): string[] { return [] }

  // -- Lifecycle Hooks --------------------------------------------------------

  beforeCreate(data: Record<string, any>): Record<string, any> | Promise<Record<string, any>> { return data }
  afterCreate(record: Model): void | Promise<void> {}
  beforeSave(record: Model, data: Record<string, any>): Record<string, any> | Promise<Record<string, any>> { return data }
  afterSave(record: Model): void | Promise<void> {}
  beforeDelete(record: Model): void | Promise<void> {}
  afterDelete(record: Model): void | Promise<void> {}

  // -- Authorization ----------------------------------------------------------

  static canViewAny(user: Authenticatable): boolean | Promise<boolean> { return true }
  static canView(user: Authenticatable, record: Model): boolean | Promise<boolean> { return true }
  static canCreate(user: Authenticatable): boolean | Promise<boolean> { return true }
  static canUpdate(user: Authenticatable, record: Model): boolean | Promise<boolean> { return true }
  static canDelete(user: Authenticatable, record: Model): boolean | Promise<boolean> { return true }

  // -- Serialization ----------------------------------------------------------

  toSchema(): Record<string, any>
}
```

#### 5.2 ResourceRouteRegistrar

For each resource, the registrar generates these API routes under the panel prefix:

```
GET    /admin/api/resources/{resource}                  -- list (paginated, filtered, sorted)
POST   /admin/api/resources/{resource}                  -- create
GET    /admin/api/resources/{resource}/{id}              -- show (for edit/view form population)
PUT    /admin/api/resources/{resource}/{id}              -- update
DELETE /admin/api/resources/{resource}/{id}              -- delete
POST   /admin/api/resources/{resource}/actions/{action}  -- execute action
POST   /admin/api/resources/{resource}/bulk-actions/{action}  -- execute bulk action
GET    /admin/api/resources/{resource}/schema            -- resource schema (form, table, filters)
GET    /admin/api/resources/{resource}/relation/{name}   -- relation data (for Select, BelongsTo)
```

All routes are wrapped in the panel's middleware stack.

---

### 6. Form System

#### 6.1 Form Container

```typescript
class Form implements Serializable {
  private components: FormComponent[] = []
  private columns: number = 1

  static make(components: FormComponent[]): Form
  columns(count: number): this
  toSchema(): FormSchema
}
```

#### 6.2 FormComponent (Base)

Every form component extends this abstract class, following the builder pattern.

```typescript
abstract class FormComponent implements Serializable {
  protected _name: string
  protected _label: string | null = null
  protected _placeholder: string | null = null
  protected _helperText: string | null = null
  protected _hint: string | null = null
  protected _default: any = null
  protected _required: boolean = false
  protected _disabled: boolean = false
  protected _hidden: boolean = false
  protected _rules: string[] = []
  protected _columnSpan: number | 'full' = 1
  protected _reactive: boolean = false
  protected _dependsOn: string[] = []
  protected _visibleWhen: ((data: Record<string, any>) => boolean) | null = null
  protected _afterStateUpdated: string | null = null

  constructor(name: string)
  static make(name: string): static

  label(label: string): this
  placeholder(placeholder: string): this
  helperText(text: string): this
  hint(text: string): this
  default(value: any): this
  required(condition?: boolean): this
  disabled(condition?: boolean): this
  hidden(condition?: boolean): this
  rules(rules: string): this
  columnSpan(span: number | 'full'): this
  reactive(): this
  dependsOn(fields: string[]): this
  visible(condition: (data: Record<string, any>) => boolean): this

  abstract type(): string

  toSchema(): FormComponentSchema {
    return {
      type: this.type(),
      name: this._name,
      label: this._label ?? this.humanize(this._name),
      placeholder: this._placeholder,
      helperText: this._helperText,
      hint: this._hint,
      default: this._default,
      required: this._required,
      disabled: this._disabled,
      hidden: this._hidden,
      rules: this._rules,
      columnSpan: this._columnSpan,
      reactive: this._reactive,
      dependsOn: this._dependsOn,
      ...this.extraSchema(),
    }
  }

  protected extraSchema(): Record<string, any> { return {} }
}
```

#### 6.3 Concrete Form Components

**TextInput**:
```typescript
class TextInput extends FormComponent {
  protected _type: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number' = 'text'
  protected _maxLength: number | null = null
  protected _minLength: number | null = null
  protected _prefix: string | null = null
  protected _suffix: string | null = null
  protected _mask: string | null = null

  override type(): string { return 'text-input' }
  email(): this
  password(): this
  tel(): this
  url(): this
  numeric(): this
  maxLength(max: number): this
  minLength(min: number): this
  prefix(prefix: string): this
  suffix(suffix: string): this
  mask(mask: string): this
  unique(table: string, column: string, ignoreId?: string): this
}
```

**Select**:
```typescript
class Select extends FormComponent {
  protected _options: Record<string, string> | null = null
  protected _relationship: string | null = null
  protected _searchable: boolean = false
  protected _multiple: boolean = false
  protected _preload: boolean = false
  protected _optionLabel: string = 'name'
  protected _optionValue: string = 'id'
  protected _createOption: boolean = false

  override type(): string { return 'select' }
  options(options: Record<string, string>): this
  relationship(name: string, titleAttribute: string): this
  searchable(condition?: boolean): this
  multiple(condition?: boolean): this
  preload(condition?: boolean): this
  native(condition?: boolean): this
  createOptionForm(form: Form): this
}
```

**Repeater** (nested arrays):
```typescript
class Repeater extends FormComponent {
  protected _schema: FormComponent[] = []
  protected _minItems: number = 0
  protected _maxItems: number | null = null
  protected _collapsible: boolean = false
  protected _reorderable: boolean = true
  protected _addActionLabel: string = 'Add item'
  protected _relationship: string | null = null

  override type(): string { return 'repeater' }
  schema(components: FormComponent[]): this
  minItems(min: number): this
  maxItems(max: number): this
  collapsible(condition?: boolean): this
  reorderable(condition?: boolean): this
  addActionLabel(label: string): this
  relationship(name: string): this
}
```

Other form components: `Textarea`, `RichEditor`, `MultiSelect`, `Checkbox`, `CheckboxList`, `Toggle`, `Radio`, `DatePicker`, `TimePicker`, `DateTimePicker`, `ColorPicker`, `FileUpload`, `ImageUpload` (extends FileUpload), `KeyValue`, `TagsInput`, `Hidden`, `Placeholder`.

#### 6.4 Layout Components

```typescript
class Section extends FormComponent {
  protected _heading: string
  protected _description: string | null = null
  protected _schema: FormComponent[] = []
  protected _collapsible: boolean = false
  protected _collapsed: boolean = false
  protected _aside: boolean = false
  protected _icon: string | null = null

  override type(): string { return 'section' }
}

class Tabs extends FormComponent {
  protected _tabs: Tab[] = []
  override type(): string { return 'tabs' }
}

class Tab {
  label: string
  icon: string | null = null
  schema: FormComponent[] = []
  badge: string | number | null = null
}

class Grid extends FormComponent {
  protected _schema: FormComponent[] = []
  protected _columns: number = 2
  override type(): string { return 'grid' }
}

class Wizard extends FormComponent {
  protected _steps: WizardStep[] = []
  protected _cancelAction: boolean = true
  protected _submitAction: string = 'Submit'
  override type(): string { return 'wizard' }
}

class WizardStep {
  label: string
  description: string | null = null
  icon: string | null = null
  schema: FormComponent[] = []
}
```

---

### 7. Table System

#### 7.1 Table Container

```typescript
class Table implements Serializable {
  private _columns: Column[] = []
  private _filters: Filter[] = []
  private _actions: Action[] = []
  private _bulkActions: BulkAction[] = []
  private _headerActions: Action[] = []
  private _searchable: boolean = true
  private _paginated: boolean = true
  private _paginationPageOptions: number[] = [10, 25, 50, 100]
  private _defaultSort: string | null = null
  private _defaultSortDirection: 'asc' | 'desc' = 'asc'
  private _striped: boolean = false
  private _emptyStateHeading: string = 'No records found'
  private _emptyStateDescription: string | null = null
  private _emptyStateIcon: string = 'inbox'
  private _poll: number | null = null            // polling interval in seconds

  static make(columns: Column[]): Table
  filters(filters: Filter[]): this
  actions(actions: Action[]): this
  bulkActions(actions: BulkAction[]): this
  headerActions(actions: Action[]): this
  searchable(condition?: boolean): this
  paginated(condition?: boolean): this
  paginationPageOptions(options: number[]): this
  defaultSort(column: string, direction?: 'asc' | 'desc'): this
  striped(condition?: boolean): this
  emptyState(heading: string, description?: string, icon?: string): this
  poll(seconds: number): this

  toSchema(): TableSchema
}
```

#### 7.2 Column (Base)

```typescript
abstract class Column implements Serializable {
  protected _name: string
  protected _label: string | null = null
  protected _sortable: boolean = false
  protected _searchable: boolean = false
  protected _toggleable: boolean = true
  protected _hidden: boolean = false
  protected _alignment: 'start' | 'center' | 'end' = 'start'
  protected _width: string | null = null
  protected _wrap: boolean = false
  protected _description: string | null = null
  protected _tooltip: string | null = null
  protected _formatUsing: ((value: any, record: Record<string, any>) => any) | null = null

  constructor(name: string)
  static make(name: string): static

  label(label: string): this
  sortable(condition?: boolean): this
  searchable(condition?: boolean): this
  toggleable(condition?: boolean): this
  hidden(condition?: boolean): this
  alignment(alignment: 'start' | 'center' | 'end'): this
  width(width: string): this
  wrap(condition?: boolean): this
  description(description: string): this
  tooltip(tooltip: string): this
  formatStateUsing(callback: (value: any, record: Record<string, any>) => any): this

  abstract type(): string
  toSchema(): ColumnSchema
  protected extraSchema(): Record<string, any> { return {} }
}
```

**TextColumn**:
```typescript
class TextColumn extends Column {
  protected _limit: number | null = null
  protected _prefix: string | null = null
  protected _suffix: string | null = null
  protected _dateTime: boolean = false
  protected _date: boolean = false
  protected _since: boolean = false
  protected _money: string | null = null
  protected _numeric: boolean = false
  protected _badge: boolean = false
  protected _color: string | null = null
  protected _icon: string | null = null
  protected _iconPosition: 'before' | 'after' = 'before'
  protected _copyable: boolean = false
  protected _url: ((record: Record<string, any>) => string) | null = null

  override type(): string { return 'text' }
  limit(chars: number): this
  prefix(prefix: string): this
  suffix(suffix: string): this
  dateTime(format?: string): this
  date(format?: string): this
  since(): this
  money(currency?: string): this
  numeric(decimalPlaces?: number, thousandsSeparator?: string): this
  badge(): this
  color(color: string): this
  icon(icon: string, position?: 'before' | 'after'): this
  copyable(): this
  url(callback: (record: Record<string, any>) => string): this
}
```

**BadgeColumn**: `color`, `colors` (map value to color), `icon`, `icons`.

**BooleanColumn**: `trueIcon`, `falseIcon`, `trueColor`, `falseColor`.

**ImageColumn**: `circular`, `square`, `size`, `defaultUrl`.

**IconColumn**: `boolean`, `color`, `size`.

**ColorColumn**: `copyable`.

#### 7.3 Filters

```typescript
abstract class Filter implements Serializable {
  protected _name: string
  protected _label: string | null = null
  protected _default: any = null

  constructor(name: string)
  static make(name: string): static
  label(label: string): this
  default(value: any): this
  abstract type(): string
  abstract apply(query: ModelQueryBuilder<any>, value: any): ModelQueryBuilder<any>
  toSchema(): FilterSchema
}

class SelectFilter extends Filter {
  protected _options: Record<string, string> = {}
  protected _multiple: boolean = false
  protected _searchable: boolean = false
  protected _relationship: string | null = null

  override type(): string { return 'select' }
  options(options: Record<string, string>): this
  multiple(condition?: boolean): this
  searchable(condition?: boolean): this
  relationship(name: string, titleAttribute: string): this
  override apply(query: ModelQueryBuilder<any>, value: any): ModelQueryBuilder<any>
}

class TernaryFilter extends Filter {
  protected _trueLabel: string = 'Yes'
  protected _falseLabel: string = 'No'
  protected _nullable: boolean = true

  override type(): string { return 'ternary' }
  trueLabel(label: string): this
  falseLabel(label: string): this
  override apply(query: ModelQueryBuilder<any>, value: any): ModelQueryBuilder<any>
}

class DateFilter extends Filter {
  override type(): string { return 'date' }
  override apply(query: ModelQueryBuilder<any>, value: any): ModelQueryBuilder<any>
}

class QueryFilter extends Filter {
  protected _formSchema: FormComponent[] = []
  override type(): string { return 'query' }
  form(components: FormComponent[]): this
  override apply(query: ModelQueryBuilder<any>, value: any): ModelQueryBuilder<any>
}
```

---

### 8. Action System

```typescript
abstract class Action implements Serializable {
  protected _name: string
  protected _label: string | null = null
  protected _icon: string | null = null
  protected _color: 'primary' | 'danger' | 'warning' | 'success' | 'info' = 'primary'
  protected _requiresConfirmation: boolean = false
  protected _confirmationHeading: string = 'Are you sure?'
  protected _confirmationDescription: string = ''
  protected _confirmationButtonLabel: string = 'Confirm'
  protected _cancelButtonLabel: string = 'Cancel'
  protected _modalForm: Form | null = null
  protected _hidden: boolean = false
  protected _disabled: boolean = false
  protected _url: string | null = null
  protected _successNotification: string | null = null
  protected _authorization: ((user: Authenticatable, record?: Model) => boolean | Promise<boolean>) | null = null

  constructor(name: string)
  static make(name?: string): static

  label(label: string): this
  icon(icon: string): this
  color(color: 'primary' | 'danger' | 'warning' | 'success' | 'info'): this
  requiresConfirmation(heading?: string, description?: string): this
  form(form: Form): this
  authorize(callback: (user: Authenticatable, record?: Model) => boolean | Promise<boolean>): this
  successNotification(message: string): this
  hidden(condition?: boolean): this
  disabled(condition?: boolean): this

  abstract handle(record: Model, data?: Record<string, any>): Promise<ActionResult>

  toSchema(): ActionSchema
}

class EditAction extends Action {
  override handle(record: Model, data?: Record<string, any>): Promise<ActionResult>
}

class DeleteAction extends Action {
  constructor() {
    super('delete')
    this._color = 'danger'
    this._requiresConfirmation = true
    this._icon = 'trash'
    this._confirmationHeading = 'Delete record'
    this._confirmationDescription = 'Are you sure you want to delete this record? This action cannot be undone.'
  }
  override handle(record: Model): Promise<ActionResult>
}

class ViewAction extends Action {
  override handle(record: Model): Promise<ActionResult>
}

class BulkAction implements Serializable {
  // Similar to Action but operates on a collection of records
  abstract handle(records: Model[], data?: Record<string, any>): Promise<ActionResult>
}

class BulkDeleteAction extends BulkAction { ... }

interface ActionResult {
  type: 'success' | 'failure' | 'redirect'
  message?: string
  redirectUrl?: string
}
```

---

### 9. Widget System

```typescript
abstract class Widget implements Serializable {
  protected _columnSpan: number | 'full' = 'full'
  protected _sort: number = 0
  protected _lazy: boolean = false
  protected _poll: number | null = null

  columnSpan(span: number | 'full'): this
  sort(order: number): this
  lazy(condition?: boolean): this
  poll(seconds: number): this

  abstract type(): string
  abstract getData(): Promise<Record<string, any>>
  toSchema(): WidgetSchema
}

class StatsWidget extends Widget {
  protected _stats: Stat[] = []

  override type(): string { return 'stats' }
  stats(stats: Stat[]): this
  override async getData(): Promise<Record<string, any>>
}

class Stat {
  protected _label: string
  protected _value: string | number
  protected _description: string | null = null
  protected _descriptionIcon: string | null = null
  protected _color: string | null = null
  protected _chart: number[] | null = null    // sparkline data
  protected _trend: 'up' | 'down' | null = null

  static make(label: string, value: string | number): Stat
  description(description: string): this
  descriptionIcon(icon: string): this
  color(color: string): this
  chart(data: number[]): this
  trend(trend: 'up' | 'down'): this

  toSchema(): StatSchema
}

class ChartWidget extends Widget {
  protected _heading: string = ''
  protected _chartType: 'line' | 'bar' | 'pie' | 'doughnut' | 'area' = 'line'
  protected _description: string | null = null

  override type(): string { return 'chart' }
  heading(heading: string): this
  chartType(type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area'): this
  description(description: string): this

  abstract getDatasets(): Promise<ChartDataset[]>
  abstract getLabels(): Promise<string[]>
  override async getData(): Promise<Record<string, any>>
}

interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string
}

class TableWidget extends Widget {
  protected _table: Table | null = null
  protected _heading: string = ''

  override type(): string { return 'table' }
  heading(heading: string): this
  table(table: Table): this
  override async getData(): Promise<Record<string, any>>
}
```

---

### 10. Navigation System

```typescript
class NavigationBuilder {
  /** Auto-generates navigation from registered resources. */
  static buildFromResources(resources: Constructor<Resource>[]): NavigationSchema

  /** Merges auto-generated nav with user-defined groups. */
  static build(
    resources: Constructor<Resource>[],
    groups: NavigationGroup[],
  ): NavigationSchema
}

class NavigationGroup implements Serializable {
  protected _label: string
  protected _icon: string | null = null
  protected _items: NavigationItem[] = []
  protected _collapsible: boolean = true

  static make(label: string): NavigationGroup
  icon(icon: string): this
  items(items: NavigationItem[]): this
  collapsible(condition?: boolean): this
  toSchema(): NavigationGroupSchema
}

class NavigationItem implements Serializable {
  protected _label: string
  protected _icon: string | null = null
  protected _url: string
  protected _badge: string | number | null = null
  protected _badgeColor: string = 'primary'
  protected _active: boolean = false
  protected _children: NavigationItem[] = []

  static make(label: string, url: string): NavigationItem
  icon(icon: string): this
  badge(badge: string | number): this
  badgeColor(color: string): this
  children(items: NavigationItem[]): this
  isActive(condition: boolean): this
  toSchema(): NavigationItemSchema
}
```

---

### 11. JSON Schema Protocol

The communication between backend and frontend follows a typed JSON protocol. Each schema has a `type` discriminator that the frontend component registry uses to select the appropriate React component.

#### 11.1 Page Schema (top-level)

```typescript
interface PageSchema {
  type: 'page'
  layout: 'resource-list' | 'resource-create' | 'resource-edit' | 'resource-view' | 'dashboard' | 'custom'
  title: string
  breadcrumbs: { label: string; url?: string }[]
  content: TableSchema | FormSchema | InfolistSchema | WidgetSchema[] | CustomContentSchema
  headerWidgets?: WidgetSchema[]
  footerWidgets?: WidgetSchema[]
  headerActions?: ActionSchema[]
}
```

#### 11.2 Panel Schema (global config)

```typescript
interface PanelSchema {
  brandName: string
  brandLogo: string | null
  navigation: NavigationGroupSchema[]
  user: { name: string; email: string; avatar?: string } | null
  darkMode: boolean
  colors: Record<string, string>
  notifications: { unreadCount: number }
}
```

#### 11.3 Table Schema

```typescript
interface TableSchema {
  type: 'table'
  columns: ColumnSchema[]
  filters: FilterSchema[]
  actions: ActionSchema[]
  bulkActions: ActionSchema[]
  headerActions: ActionSchema[]
  searchable: boolean
  data: {
    items: Record<string, any>[]
    meta: {
      total: number
      currentPage: number
      perPage: number
      lastPage: number
      from: number
      to: number
    }
  }
  emptyState: { heading: string; description: string | null; icon: string }
  poll: number | null
}
```

#### 11.4 Form Schema

```typescript
interface FormSchema {
  type: 'form'
  components: FormComponentSchema[]
  columns: number
  data: Record<string, any>   // current values (for edit)
}

interface FormComponentSchema {
  type: string                 // 'text-input' | 'select' | 'section' | etc.
  name: string
  label: string
  placeholder: string | null
  helperText: string | null
  hint: string | null
  default: any
  required: boolean
  disabled: boolean
  hidden: boolean
  rules: string[]
  columnSpan: number | 'full'
  reactive: boolean
  dependsOn: string[]
  [key: string]: any           // component-specific props
}
```

#### 11.5 Action Schema

```typescript
interface ActionSchema {
  type: 'action'
  name: string
  label: string
  icon: string | null
  color: string
  requiresConfirmation: boolean
  confirmation: {
    heading: string
    description: string
    buttonLabel: string
    cancelLabel: string
  } | null
  form: FormSchema | null
  hidden: boolean
  disabled: boolean
  url: string | null            // for redirect actions
}
```

---

### 12. HTTP Layer

#### 12.1 StudioController

The controller handles all backend API requests for Studio. Each endpoint validates auth, resolves the resource, and returns JSON.

```typescript
class StudioController {
  /** GET /admin/api/panel -- returns PanelSchema (nav, config, user) */
  async panel(request: MantiqRequest): Promise<Response>

  /** GET /admin/api/resources/:resource -- list records */
  async index(request: MantiqRequest): Promise<Response>

  /** POST /admin/api/resources/:resource -- create record */
  async store(request: MantiqRequest): Promise<Response>

  /** GET /admin/api/resources/:resource/:id -- show record */
  async show(request: MantiqRequest): Promise<Response>

  /** PUT /admin/api/resources/:resource/:id -- update record */
  async update(request: MantiqRequest): Promise<Response>

  /** DELETE /admin/api/resources/:resource/:id -- delete record */
  async destroy(request: MantiqRequest): Promise<Response>

  /** POST /admin/api/resources/:resource/actions/:action -- run action */
  async action(request: MantiqRequest): Promise<Response>

  /** POST /admin/api/resources/:resource/bulk-actions/:action -- run bulk action */
  async bulkAction(request: MantiqRequest): Promise<Response>

  /** GET /admin/api/resources/:resource/schema -- resource form+table schema */
  async schema(request: MantiqRequest): Promise<Response>

  /** GET /admin/api/resources/:resource/relation/:name -- relation options */
  async relation(request: MantiqRequest): Promise<Response>

  /** GET /admin/api/widgets/:widget -- widget data */
  async widget(request: MantiqRequest): Promise<Response>

  /** GET /admin/api/global-search?q=... -- global search */
  async globalSearch(request: MantiqRequest): Promise<Response>

  /** GET /admin/api/notifications -- user notifications */
  async notifications(request: MantiqRequest): Promise<Response>

  /** POST /admin/api/notifications/:id/read -- mark as read */
  async markNotificationRead(request: MantiqRequest): Promise<Response>
}
```

#### 12.2 Route Registration

The `PanelRouteRegistrar` registers routes as a route group under the panel path:

```typescript
// All API routes under /admin/api/...
router.group({ prefix: '/admin', middleware: [...panelMiddleware] }, () => {
  // Panel config
  router.get('/api/panel', [StudioController, 'panel'])

  // Resource CRUD
  router.get('/api/resources/:resource', [StudioController, 'index'])
  router.post('/api/resources/:resource', [StudioController, 'store'])
  router.get('/api/resources/:resource/:id', [StudioController, 'show'])
  router.put('/api/resources/:resource/:id', [StudioController, 'update'])
  router.delete('/api/resources/:resource/:id', [StudioController, 'destroy'])

  // Resource schema
  router.get('/api/resources/:resource/schema', [StudioController, 'schema'])

  // Relations
  router.get('/api/resources/:resource/relation/:name', [StudioController, 'relation'])

  // Actions
  router.post('/api/resources/:resource/actions/:action', [StudioController, 'action'])
  router.post('/api/resources/:resource/bulk-actions/:action', [StudioController, 'bulkAction'])

  // Widgets
  router.get('/api/widgets/:widget', [StudioController, 'widget'])

  // Global search
  router.get('/api/global-search', [StudioController, 'globalSearch'])

  // Notifications
  router.get('/api/notifications', [StudioController, 'notifications'])
  router.post('/api/notifications/:id/read', [StudioController, 'markNotificationRead'])

  // SPA catch-all: serves the React app for all non-API routes
  router.get('/{path:.*}', [StudioController, 'spa'])
})
```

#### 12.3 Middleware

**StudioAuthenticate** extends `Authenticate` from `@mantiq/auth` but adds Studio-specific behavior: instead of redirecting to `/login`, it redirects to the panel's login page (e.g., `/admin/login`). The guard used is configurable per-panel.

**StudioServeAssets** serves the pre-built React app's static assets from the package's `frontend/dist/` directory. It resolves asset paths relative to the package location using `import.meta.dir`.

---

### 13. Frontend Architecture

The React frontend is a standalone SPA bundled with the package. It is built once during package build and served by `StudioServeAssets` middleware.

#### 13.1 Component Registry

```typescript
// frontend/src/components/registry.ts
const componentRegistry: Record<string, React.ComponentType<any>> = {
  // Forms
  'text-input': TextInput,
  'textarea': Textarea,
  'rich-editor': RichEditor,
  'select': Select,
  'multi-select': MultiSelect,
  'checkbox': Checkbox,
  'checkbox-list': CheckboxList,
  'toggle': Toggle,
  'radio': Radio,
  'date-picker': DatePicker,
  'time-picker': TimePicker,
  'date-time-picker': DateTimePicker,
  'color-picker': ColorPicker,
  'file-upload': FileUpload,
  'repeater': Repeater,
  'key-value': KeyValue,
  'tags-input': TagsInput,
  'hidden': Hidden,
  'placeholder': PlaceholderComponent,
  // Layout
  'section': SectionLayout,
  'tabs': TabsLayout,
  'grid': GridLayout,
  'fieldset': FieldsetLayout,
  'card': CardLayout,
  'wizard': WizardLayout,
  // Table columns
  'text': TextColumnCell,
  'badge': BadgeColumnCell,
  'boolean': BooleanColumnCell,
  'image': ImageColumnCell,
  'icon': IconColumnCell,
  'color': ColorColumnCell,
  // Filters
  'select-filter': SelectFilterComponent,
  'ternary-filter': TernaryFilterComponent,
  'date-filter': DateFilterComponent,
  'query-filter': QueryFilterComponent,
  // Widgets
  'stats': StatsWidgetComponent,
  'chart': ChartWidgetComponent,
  'table-widget': TableWidgetComponent,
  // Infolist entries
  'text-entry': TextEntryComponent,
  'badge-entry': BadgeEntryComponent,
  'boolean-entry': BooleanEntryComponent,
  'image-entry': ImageEntryComponent,
}

/** Register custom components (user extension point) */
function registerComponent(type: string, component: React.ComponentType<any>): void

/** Resolve a component by schema type */
function resolveComponent(type: string): React.ComponentType<any> | null
```

#### 13.2 API Client

The frontend uses a thin fetch wrapper that:
- Automatically includes CSRF tokens from cookies
- Sends `X-Mantiq: true` header for SPA navigation
- Handles 401 (redirect to login), 422 (validation errors), 403 (unauthorized)
- Supports query parameter serialization for filters, sorting, pagination

#### 13.3 Real-time Integration

When `@mantiq/realtime` is available, the frontend connects via WebSocket and subscribes to a `private:studio.{panelId}` channel. Events:
- `resource.created` -- refresh table data
- `resource.updated` -- update row in table
- `resource.deleted` -- remove row from table
- `notification` -- show toast notification

The `poll` option on tables and widgets is the fallback when realtime is not available.

---

### 14. Integration Points

#### 14.1 With `@mantiq/core`
- `ServiceProvider` for registration
- `Container` for dependency injection
- `Router` for route registration
- `Middleware` pipeline for authentication
- `MantiqRequest` / `Response` for HTTP handling
- `ConfigRepository` for panel config

#### 14.2 With `@mantiq/database`
- `Model` for CRUD operations
- `ModelQueryBuilder` for filtering, sorting, searching
- `PaginationResult` for table pagination
- Relations for Select fields (BelongsTo, HasMany)
- Soft deletes support (trash, restore, force delete)

#### 14.3 With `@mantiq/auth`
- `Authenticate` middleware for panel access
- `Authenticatable` for authorization checks
- Guard resolution for multi-guard setups (admin vs user guards)

#### 14.4 With `@mantiq/validation`
- Form submission validation using the `Validator`
- Rule strings from form components are validated server-side
- `ValidationError` responses (422) are handled by the frontend to show field errors

#### 14.5 With `@mantiq/vite`
- The bundled React app uses Vite for development and production builds
- `Vite.page()` renders the Studio SPA shell
- Hot module replacement in development

#### 14.6 With `@mantiq/realtime`
- WebSocket subscriptions for live table updates
- Presence channels for "who's editing" indicators (optional)
- Broadcast events when resources are modified

---

### 15. Testing Plan

#### 15.1 Unit Tests -- Form Components (per component)

Each form component test verifies:
1. `make()` creates instance with correct name
2. Builder methods set properties correctly
3. `toSchema()` serializes all properties to correct JSON shape
4. Default values are correct
5. `required()` adds the required flag
6. `rules()` accumulates rule strings
7. `columnSpan()` sets span correctly
8. `reactive()` and `dependsOn()` set reactive state
9. Component-specific methods work (e.g., `TextInput.email()` sets type to 'email')

Example test file: `forms/TextInput.test.ts`

| Test | Description |
|------|-------------|
| `make-creates-instance` | `TextInput.make('name')` returns a TextInput with `_name = 'name'` |
| `label-sets-label` | `.label('Full Name')` sets `_label` |
| `email-sets-type` | `.email()` sets internal type to 'email' |
| `password-sets-type` | `.password()` sets internal type to 'password' |
| `maxLength-sets-value` | `.maxLength(255)` sets `_maxLength = 255` |
| `prefix-sets-value` | `.prefix('$')` sets `_prefix` |
| `suffix-sets-value` | `.suffix('@example.com')` sets `_suffix` |
| `mask-sets-value` | `.mask('###-###-####')` sets `_mask` |
| `toSchema-returns-correct-type` | Schema has `type: 'text-input'` |
| `toSchema-includes-all-properties` | All set properties appear in schema |
| `toSchema-default-label` | No explicit label uses humanized name |
| `required-adds-flag` | `.required()` sets `required: true` in schema |
| `rules-accumulates` | `.rules('min:3').rules('max:255')` includes both |
| `chaining-works` | Multiple chained calls return correct schema |

Similar test suites for: `Textarea`, `Select`, `MultiSelect`, `Checkbox`, `Toggle`, `Radio`, `DatePicker`, `TimePicker`, `DateTimePicker`, `ColorPicker`, `FileUpload`, `Repeater`, `KeyValue`, `TagsInput`, `Hidden`, `Placeholder`.

#### 15.2 Unit Tests -- Layout Components

| Test | Description |
|------|-------------|
| `section-serializes-children` | Section with 3 children includes all in schema |
| `section-collapsible` | `.collapsible()` sets flag in schema |
| `tabs-serializes-tabs` | Tabs with 2 Tab objects includes both |
| `tabs-tab-schema` | Each Tab has label, icon, badge, schema |
| `grid-sets-columns` | `.columns(3)` sets columns in schema |
| `wizard-serializes-steps` | Steps appear in schema with label, description, schema |
| `card-includes-heading` | Card heading and description in schema |

#### 15.3 Unit Tests -- Table Columns

| Test | Description |
|------|-------------|
| `text-column-make` | `TextColumn.make('name')` creates column |
| `text-column-sortable` | `.sortable()` sets flag |
| `text-column-searchable` | `.searchable()` sets flag |
| `text-column-dateTime` | `.dateTime()` sets date formatting |
| `text-column-money` | `.money('USD')` sets currency formatting |
| `text-column-limit` | `.limit(50)` truncates display |
| `text-column-copyable` | `.copyable()` adds copy action |
| `badge-column-colors` | `.colors({ admin: 'primary' })` maps values to colors |
| `boolean-column-icons` | `.trueIcon('check')` sets icon |
| `image-column-circular` | `.circular()` sets circular display |
| `schema-type-correct` | Each column returns correct type string |

#### 15.4 Unit Tests -- Filters

| Test | Description |
|------|-------------|
| `select-filter-options` | `.options({ admin: 'Admin' })` serializes options |
| `select-filter-apply` | `apply()` adds `where` clause to query |
| `ternary-filter-labels` | Custom true/false labels in schema |
| `ternary-filter-apply-true` | Value `true` adds `where(column, true)` |
| `ternary-filter-apply-false` | Value `false` adds `where(column, false)` |
| `ternary-filter-apply-null` | Null value does not modify query |
| `date-filter-apply` | Adds date range where clause |

#### 15.5 Unit Tests -- Actions

| Test | Description |
|------|-------------|
| `action-make` | `DeleteAction.make()` creates with defaults |
| `action-requiresConfirmation` | Sets confirmation dialog schema |
| `action-form` | Modal form serializes correctly |
| `action-color` | `.color('danger')` sets color |
| `action-authorization` | `.authorize(callback)` stores callback |
| `delete-action-defaults` | Delete has danger color, confirmation, trash icon |
| `bulk-action-schema` | Bulk action serializes for multiple records |

#### 15.6 Unit Tests -- Widgets

| Test | Description |
|------|-------------|
| `stats-widget-schema` | Stats with 3 Stat objects serialize correctly |
| `stat-make` | `Stat.make('Users', 100)` creates stat |
| `stat-trend` | `.trend('up')` includes trend |
| `stat-chart` | `.chart([1,2,3])` includes sparkline data |
| `chart-widget-schema` | Chart type, heading, description serialize |
| `chart-widget-getData` | getData returns labels and datasets |
| `table-widget-schema` | Table widget wraps a Table schema |

#### 15.7 Unit Tests -- Resource

| Test | Description |
|------|-------------|
| `resource-slug-from-model` | Slug defaults to kebab-cased plural model name |
| `resource-pages-default` | Default pages include index, create, edit, view |
| `resource-toSchema` | Includes form, table, navigation info |
| `resource-modifyQuery` | Base modifyQuery returns query unchanged |
| `resource-lifecycle-hooks` | beforeCreate, afterCreate called during create |
| `resource-authorization-defaults` | All canXxx methods return true by default |

#### 15.8 Unit Tests -- Navigation

| Test | Description |
|------|-------------|
| `builds-from-resources` | 3 resources produce 3 nav items |
| `groups-resources` | Resources with same navigationGroup are grouped |
| `sorts-by-navigationSort` | Items are ordered by sort number |
| `includes-badges` | navigationBadge callback result appears |
| `merges-custom-groups` | User-defined groups merge with auto-generated |

#### 15.9 Unit Tests -- Schema

| Test | Description |
|------|-------------|
| `page-schema-valid` | Page schema has type, layout, title, breadcrumbs, content |
| `panel-schema-includes-nav` | Panel schema includes navigation tree |
| `table-schema-includes-data` | Table schema includes items and meta |
| `form-schema-includes-data` | Form schema includes current values |

#### 15.10 Unit Tests -- Panel

| Test | Description |
|------|-------------|
| `panel-registers-routes` | Panel boot registers expected route count |
| `panel-middleware` | Panel middleware is applied to all routes |
| `panel-resources-resolved` | All resources are instantiated |
| `panel-default-config` | Default colors, dark mode, etc. |

#### 15.11 Integration Tests

| Test | Description |
|------|-------------|
| `resource-list-endpoint` | GET returns paginated records with table schema |
| `resource-create-endpoint` | POST with valid data creates record, returns success |
| `resource-create-validation` | POST with invalid data returns 422 with field errors |
| `resource-update-endpoint` | PUT with valid data updates record |
| `resource-delete-endpoint` | DELETE removes record |
| `resource-filter-applied` | Query params `?filter[role]=admin` filters records |
| `resource-sort-applied` | Query param `?sort=name` sorts records |
| `resource-search-applied` | Query param `?search=alice` searches searchable columns |
| `resource-pagination` | Query params `?page=2&perPage=10` paginates correctly |
| `action-execution` | POST to action endpoint runs action on record |
| `action-authorization-denied` | Unauthorized action returns 403 |
| `bulk-action-execution` | POST with record IDs runs bulk action |
| `panel-schema-endpoint` | GET returns full panel config and navigation |
| `widget-data-endpoint` | GET returns widget data |
| `relation-data-endpoint` | GET returns related model options for Select |
| `global-search` | Search across all resources |
| `soft-delete-resource` | Trash, restore, force delete flow |
| `spa-catch-all` | Non-API routes return HTML shell |

---

### 16. Implementation Phases

**Phase 1: Foundation (Core abstractions + Form system)**
1. Package scaffolding (package.json, tsconfig.json, index.ts)
2. `Serializable` interface
3. `FormComponent` base class and all concrete form components
4. Layout components (Section, Tabs, Grid, Wizard)
5. `Form` container
6. Unit tests for every form component

**Phase 2: Table System**
1. `Column` base class and all concrete columns
2. `Filter` base class and all concrete filters
3. `Table` container
4. Unit tests for every column and filter

**Phase 3: Actions + Widgets**
1. `Action` base class, built-in actions
2. `BulkAction` base class, built-in bulk actions
3. `Widget` base class, StatsWidget, ChartWidget, TableWidget
4. `Stat` builder
5. Unit tests

**Phase 4: Resource + Navigation**
1. `Resource` abstract class
2. `NavigationBuilder`, `NavigationGroup`, `NavigationItem`
3. Schema types (all `*Schema` interfaces)
4. `SchemaEncoder`
5. Unit tests

**Phase 5: HTTP Layer + Panel**
1. `StudioPanel` abstract class
2. `PanelManager`
3. `PanelRouteRegistrar`
4. `StudioController` (all CRUD + schema endpoints)
5. `StudioAuthenticate` middleware
6. `StudioServiceProvider`
7. Integration tests

**Phase 6: Frontend**
1. React app scaffolding (Vite + React + shadcn/ui)
2. Component registry
3. API client
4. PanelLayout (sidebar, topbar, breadcrumbs)
5. FormRenderer + all form components
6. TableRenderer + DataTable + filters + pagination
7. Action modals
8. Widget renderers
9. Page components (list, create, edit, view, dashboard)
10. Dark mode + theming

**Phase 7: Real-time + Polish**
1. WebSocket integration for live updates
2. Notifications system
3. Global search
4. Infolists
5. Custom page support
6. E2E tests
7. Documentation + example admin panel

---

### 17. Key Design Decisions

1. **Static `make()` pattern everywhere**: Every builder class uses `static make(name)` for fluent instantiation, consistent with Filament and with Mantiq's existing patterns (e.g., `Expression.raw()`).

2. **`toSchema()` over `toJSON()`**: Using a custom `toSchema()` method rather than overriding `toJSON()` makes the serialization intent explicit and avoids conflicts with existing serialization behavior.

3. **Server-side filter application**: Filters have an `apply(query, value)` method that directly modifies the `ModelQueryBuilder`. This keeps all data access on the server and prevents arbitrary query construction from the client.

4. **Actions are server-executed**: All actions run on the server. The frontend sends `{ recordIds: [...], formData: {...} }` and receives an `ActionResult`. No client-side business logic.

5. **Bundled frontend**: The React app is pre-built during `bun run build` and shipped in `frontend/dist/`. The `StudioServeAssets` middleware serves these files. This means users never need to install React or shadcn/ui in their project.

6. **Extensible component registry**: Users can register custom React components that map to custom schema types. This allows extending Studio without forking it.

7. **`override` keyword**: All subclass overrides of base members use the `override` keyword per the project's `noImplicitOverride: true` tsconfig setting.

8. **Validation delegation**: Form components define `rules` strings. When a form is submitted, the `ResourceController` passes these rules to `@mantiq/validation`'s `Validator`, providing a consistent validation experience.

---

### Critical Files for Implementation

- `/Users/abdullahkhan/Projects/mantiq/packages/core/src/contracts/ServiceProvider.ts` - Base class pattern for StudioServiceProvider (register/boot lifecycle)
- `/Users/abdullahkhan/Projects/mantiq/packages/database/src/orm/Model.ts` - ORM Model class that Resource wraps (fillable, casts, relations, queries, pagination, toObject)
- `/Users/abdullahkhan/Projects/mantiq/packages/core/src/routing/ResourceRegistrar.ts` - Pattern for auto-generating CRUD routes from a resource definition
- `/Users/abdullahkhan/Projects/mantiq/specs/packages/vite.md` - Full spec format to follow, and integration point for serving the frontend SPA
- `/Users/abdullahkhan/Projects/mantiq/packages/auth/src/middleware/Authenticate.ts` - Auth middleware pattern to extend for StudioAuthenticate
