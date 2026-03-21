<script lang="ts" module>
  export interface Column<T> {
    id: string
    label: string
    hideable?: boolean
    className?: string
    cellClassName?: string
    sortKey?: string
    getValue?: (row: T) => any
  }

  export interface DataTableProps<T> {
    data: T[]
    columns: Column<T>[]
    loading?: boolean
    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
    page?: number
    perPage?: number
    totalItems?: number
    onPageChange?: (page: number) => void
    onPerPageChange?: (perPage: number) => void
    selectable?: boolean
    selectedIds?: Set<number | string>
    onSelectionChange?: (ids: Set<number | string>) => void
    getRowId?: (row: T) => number | string
    onSortChange?: (sortKey: string | null, sortDir: 'asc' | 'desc') => void
    emptyMessage?: string
  }
</script>

<script lang="ts" generics="T">
  import * as Table from '$lib/components/ui/table'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import {
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    SlidersHorizontal,
  } from 'lucide-svelte'
  import type { Snippet } from 'svelte'

  let {
    data,
    columns,
    loading = false,
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Search...',
    page: controlledPage,
    perPage: controlledPerPage,
    totalItems: controlledTotalItems,
    onPageChange,
    onPerPageChange,
    selectable = false,
    selectedIds: controlledSelectedIds,
    onSelectionChange,
    getRowId,
    onSortChange,
    toolbarLeft,
    toolbarRight,
    emptyMessage = 'No results found.',
    renderCell,
  }: DataTableProps<T> & {
    toolbarLeft?: Snippet
    toolbarRight?: Snippet
    renderCell?: Snippet<[{ column: Column<T>; row: T; index: number }]>
  } = $props()

  // Internal state
  let internalPage = $state(1)
  let internalPerPage = $state(10)
  let internalSelectedIds = $state(new Set<number | string>())
  let sortKey = $state<string | null>(null)
  let sortDir = $state<'asc' | 'desc'>('asc')
  let visibleColumns = $state((() => new Set(columns.map(c => c.id)))())

  // Resolve controlled vs uncontrolled
  const page = $derived(controlledPage ?? internalPage)
  const perPage = $derived(controlledPerPage ?? internalPerPage)
  const selectedIds = $derived(controlledSelectedIds ?? internalSelectedIds)

  function setPage(v: number) {
    if (onPageChange) onPageChange(v)
    else internalPage = v
  }

  function setPerPage(v: number) {
    if (onPerPageChange) onPerPageChange(v)
    else internalPerPage = v
  }

  function setSelectedIds(next: Set<number | string>) {
    if (onSelectionChange) onSelectionChange(next)
    else internalSelectedIds = next
  }

  // Sorting
  const sorted = $derived.by(() => {
    if (onSortChange) return data
    if (!sortKey) return data
    const col = columns.find(c => c.sortKey === sortKey)
    if (!col?.getValue) return data
    const list = [...data]
    list.sort((a, b) => {
      const av = col.getValue!(a) ?? ''
      const bv = col.getValue!(b) ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  })

  // Pagination
  const isServerPaginated = $derived(controlledTotalItems != null)
  const totalItems = $derived(controlledTotalItems ?? sorted.length)
  const totalPages = $derived(Math.max(1, Math.ceil(totalItems / perPage)))
  const paginated = $derived(isServerPaginated ? sorted : sorted.slice((page - 1) * perPage, page * perPage))

  // Clamp page
  $effect(() => {
    const maxPage = Math.max(1, Math.ceil(totalItems / perPage))
    if (page > maxPage) setPage(maxPage)
  })

  // Selection helpers
  const allPageSelected = $derived(
    paginated.length > 0 &&
    getRowId != null &&
    paginated.every(r => selectedIds.has(getRowId!(r)))
  )
  const somePageSelected = $derived(
    getRowId != null &&
    paginated.some(r => selectedIds.has(getRowId!(r))) &&
    !allPageSelected
  )

  function toggleAll(checked: boolean) {
    if (!getRowId) return
    const next = new Set(selectedIds)
    paginated.forEach(r => {
      const id = getRowId!(r)
      if (checked) next.add(id)
      else next.delete(id)
    })
    setSelectedIds(next)
  }

  function toggleOne(id: number | string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  // Sort helpers
  function handleSort(key: string) {
    let newKey: string | null = key
    let newDir: 'asc' | 'desc' = 'asc'

    if (sortKey === key) {
      if (sortDir === 'asc') {
        newDir = 'desc'
      } else {
        newKey = null
        newDir = 'asc'
      }
    }

    sortKey = newKey
    sortDir = newDir
    onSortChange?.(newKey, newDir)
  }

  // Column visibility
  function isColVisible(id: string) { return visibleColumns.has(id) }
  function toggleColumn(id: string) {
    const next = new Set(visibleColumns)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    visibleColumns = next
  }

  const hideableColumns = $derived(columns.filter(c => c.hideable))
  const visibleCols = $derived(columns.filter(c => isColVisible(c.id)))
  const totalColCount = $derived((selectable ? 1 : 0) + visibleCols.length)
</script>

<div class="space-y-4">
  <!-- Toolbar -->
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex flex-1 flex-wrap items-center gap-2">
      {#if onSearchChange}
        <div class="relative w-full sm:max-w-[250px]">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue ?? ''}
            oninput={(e: Event) => onSearchChange?.((e.target as HTMLInputElement).value)}
            class="h-8 pl-9 text-sm"
          />
        </div>
      {/if}
      {#if toolbarLeft}
        {@render toolbarLeft()}
      {/if}
    </div>

    <div class="flex items-center gap-2">
      {#if toolbarRight}
        {@render toolbarRight()}
      {/if}
      {#if hideableColumns.length > 0}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button variant="outline" size="sm" class="ml-auto h-8 gap-1.5" {...props}>
                <SlidersHorizontal class="size-3.5" />
                View
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-40">
            <DropdownMenu.Label>Toggle columns</DropdownMenu.Label>
            <DropdownMenu.Separator />
            {#each hideableColumns as col (col.id)}
              <DropdownMenu.CheckboxItem
                checked={isColVisible(col.id)}
                onCheckedChange={() => toggleColumn(col.id)}
              >
                {col.label}
              </DropdownMenu.CheckboxItem>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      {/if}
    </div>
  </div>

  <!-- Table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#if selectable}
            <Table.Head class="w-10">
              <button
                type="button"
                role="checkbox"
                aria-checked={somePageSelected ? 'mixed' : allPageSelected}
                onclick={() => toggleAll(!allPageSelected)}
                class="inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {allPageSelected || somePageSelected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}"
              >
                {#if allPageSelected}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5.5L4 8L8.5 2" /></svg>
                {:else if somePageSelected}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5H8" /></svg>
                {/if}
              </button>
            </Table.Head>
          {/if}
          {#each visibleCols as col (col.id)}
            <Table.Head class={col.className}>
              {#if col.sortKey}
                <button
                  type="button"
                  class="inline-flex items-center text-sm font-medium hover:text-foreground"
                  onclick={() => handleSort(col.sortKey!)}
                >
                  {col.label}
                  {#if sortKey !== col.sortKey}
                    <ArrowUpDown class="ml-1 size-3 text-muted-foreground/50" />
                  {:else if sortDir === 'asc'}
                    <ArrowUp class="ml-1 size-3" />
                  {:else}
                    <ArrowDown class="ml-1 size-3" />
                  {/if}
                </button>
              {:else}
                {col.label}
              {/if}
            </Table.Head>
          {/each}
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {#if loading}
          {#each Array(perPage) as _, i}
            <Table.Row>
              {#if selectable}
                <Table.Cell><Skeleton class="size-4 rounded" /></Table.Cell>
              {/if}
              {#each visibleCols as col (col.id)}
                <Table.Cell class={col.cellClassName}><Skeleton class="h-4 w-24" /></Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        {:else}
          {#each paginated as row, rowIndex}
            {@const rowId = getRowId?.(row)}
            <Table.Row data-state={rowId != null && selectedIds.has(rowId) ? 'selected' : undefined}>
              {#if selectable && rowId != null}
                <Table.Cell>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selectedIds.has(rowId)}
                    onclick={() => toggleOne(rowId)}
                    class="inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {selectedIds.has(rowId) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}"
                  >
                    {#if selectedIds.has(rowId)}
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5.5L4 8L8.5 2" /></svg>
                    {/if}
                  </button>
                </Table.Cell>
              {/if}
              {#each visibleCols as col (col.id)}
                <Table.Cell class={col.cellClassName}>
                  {#if renderCell}
                    {@render renderCell({ column: col, row, index: (page - 1) * perPage + rowIndex })}
                  {/if}
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
          {#if paginated.length === 0}
            <Table.Row>
              <Table.Cell colspan={totalColCount} class="h-32 text-center">
                <p class="text-sm text-muted-foreground">{emptyMessage}</p>
              </Table.Cell>
            </Table.Row>
          {/if}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- Pagination footer -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-sm text-muted-foreground">
      {#if selectable}
        {selectedIds.size} of {totalItems} row(s) selected.
      {:else}
        {totalItems} row(s) total.
      {/if}
    </p>

    <div class="flex flex-wrap items-center gap-4 sm:gap-6">
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
        <select
          value={perPage}
          onchange={(e: Event) => {
            setPerPage(Number((e.target as HTMLSelectElement).value))
            setPage(1)
          }}
          class="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      <span class="text-sm text-muted-foreground whitespace-nowrap">
        Page {page} of {totalPages}
      </span>

      <div class="flex items-center gap-1">
        <Button variant="outline" size="icon" class="size-8" disabled={page === 1} onclick={() => setPage(1)}>
          <ChevronsLeft class="size-4" />
          <span class="sr-only">First page</span>
        </Button>
        <Button variant="outline" size="icon" class="size-8" disabled={page === 1} onclick={() => setPage(page - 1)}>
          <ChevronLeft class="size-4" />
          <span class="sr-only">Previous page</span>
        </Button>
        <Button variant="outline" size="icon" class="size-8" disabled={page === totalPages} onclick={() => setPage(page + 1)}>
          <ChevronRight class="size-4" />
          <span class="sr-only">Next page</span>
        </Button>
        <Button variant="outline" size="icon" class="size-8" disabled={page === totalPages} onclick={() => setPage(totalPages)}>
          <ChevronsRight class="size-4" />
          <span class="sr-only">Last page</span>
        </Button>
      </div>
    </div>
  </div>
</div>
