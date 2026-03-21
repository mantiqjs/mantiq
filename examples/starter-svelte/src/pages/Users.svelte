<script lang="ts">
  import { api } from '$lib/api'
  import AuthenticatedLayout from '$lib/components/layout/AuthenticatedLayout.svelte'
  import Header from '$lib/components/layout/Header.svelte'
  import Main from '$lib/components/layout/Main.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import {
    MoreHorizontal,
    UserPlus,
    Mail,
    Pencil,
    Trash2,
    ListFilter,
  } from 'lucide-svelte'
  import DataTable from '$lib/components/DataTable.svelte'
  import type { Column } from '$lib/components/DataTable.svelte'
  import AddUserDialog from './users/AddUserDialog.svelte'
  import EditUserDialog from './users/EditUserDialog.svelte'
  import DeleteUserDialog from './users/DeleteUserDialog.svelte'

  export interface UserType {
    id: number
    name: string
    email: string
    status: string
    created_at: string
  }

  let {
    appName = 'MantiqJS',
    currentUser = null,
    users: initialUsers = [],
    navigate,
  }: {
    appName?: string
    currentUser?: { id: number; name: string; email: string } | null
    users?: UserType[]
    navigate: (href: string) => void
    [key: string]: any
  } = $props()

  // Mock data
  const mockUsers: UserType[] = [
    { id: 1, name: 'Olivia Martin', email: 'olivia@example.com', status: 'active', created_at: '2024-01-15' },
    { id: 2, name: 'Jackson Lee', email: 'jackson@example.com', status: 'active', created_at: '2024-02-20' },
    { id: 3, name: 'Isabella Nguyen', email: 'isabella@example.com', status: 'active', created_at: '2024-02-28' },
    { id: 4, name: 'William Kim', email: 'william@example.com', status: 'active', created_at: '2024-03-05' },
    { id: 5, name: 'Sofia Davis', email: 'sofia@example.com', status: 'inactive', created_at: '2024-03-12' },
    { id: 6, name: 'Liam Johnson', email: 'liam@example.com', status: 'active', created_at: '2024-03-20' },
    { id: 7, name: 'Emma Wilson', email: 'emma@example.com', status: 'active', created_at: '2024-04-01' },
    { id: 8, name: 'Noah Brown', email: 'noah@example.com', status: 'inactive', created_at: '2024-04-10' },
    { id: 9, name: 'Ava Garcia', email: 'ava@example.com', status: 'active', created_at: '2024-04-18' },
    { id: 10, name: 'Ethan Martinez', email: 'ethan@example.com', status: 'active', created_at: '2024-05-02' },
    { id: 11, name: 'Mia Rodriguez', email: 'mia@example.com', status: 'active', created_at: '2024-05-15' },
    { id: 12, name: 'James Anderson', email: 'james@example.com', status: 'active', created_at: '2024-05-22' },
    { id: 13, name: 'Charlotte Thomas', email: 'charlotte@example.com', status: 'inactive', created_at: '2024-06-01' },
    { id: 14, name: 'Benjamin Taylor', email: 'benjamin@example.com', status: 'active', created_at: '2024-06-10' },
    { id: 15, name: 'Amelia Hernandez', email: 'amelia@example.com', status: 'active', created_at: '2024-06-20' },
    { id: 16, name: 'Lucas Moore', email: 'lucas@example.com', status: 'active', created_at: '2024-07-01' },
    { id: 17, name: 'Harper Jackson', email: 'harper@example.com', status: 'active', created_at: '2024-07-12' },
    { id: 18, name: 'Alexander White', email: 'alexander@example.com', status: 'inactive', created_at: '2024-07-20' },
    { id: 19, name: 'Evelyn Harris', email: 'evelyn@example.com', status: 'active', created_at: '2024-08-01' },
    { id: 20, name: 'Daniel Clark', email: 'daniel@example.com', status: 'active', created_at: '2024-08-15' },
    { id: 21, name: 'Abigail Lewis', email: 'abigail@example.com', status: 'active', created_at: '2024-08-25' },
    { id: 22, name: 'Henry Robinson', email: 'henry@example.com', status: 'active', created_at: '2024-09-03' },
    { id: 23, name: 'Emily Walker', email: 'emily@example.com', status: 'inactive', created_at: '2024-09-15' },
    { id: 24, name: 'Sebastian Hall', email: 'sebastian@example.com', status: 'active', created_at: '2024-09-28' },
    { id: 25, name: 'Ella Young', email: 'ella@example.com', status: 'active', created_at: '2024-10-05' },
  ]

  let users = $state<UserType[]>(
    initialUsers && initialUsers.length > 0
      ? initialUsers.map(u => ({ ...u, status: (u as any).status ?? 'active', created_at: u.created_at ?? '' }))
      : mockUsers
  )
  let loading = $state(false)
  let search = $state('')
  let debouncedSearch = $state('')
  let statusFilter = $state<string | null>(null)
  let selectedIds = $state(new Set<number | string>())
  let page = $state(1)
  let perPage = $state(10)
  let sortKey = $state<string | null>('created_at')
  let sortDir = $state<'asc' | 'desc'>('desc')
  let total = $state(0)
  let filteredTotal = $state(0)

  // CRUD dialogs
  let addOpen = $state(false)
  let editUser = $state<UserType | null>(null)
  let deleteUser = $state<UserType | null>(null)

  // Debounce search
  let debounceTimer: ReturnType<typeof setTimeout>
  $effect(() => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedSearch = search
      page = 1
    }, 300)
  })

  // Fetch from API
  async function fetchUsers() {
    loading = true
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      sort: sortKey ?? 'created_at',
      dir: sortDir,
    })
    if (debouncedSearch) params.set('search', debouncedSearch)

    const { ok, data } = await api(`/api/users?${params}`)
    if (ok && data) {
      users = (data.data as any[]).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status ?? 'active',
        created_at: u.created_at ?? '',
      }))
      if (data.meta) {
        total = data.meta.total
        filteredTotal = data.meta.filtered_total
      }
    }
    loading = false
    selectedIds = new Set()
  }

  $effect(() => {
    // Re-fetch when pagination/sort/search changes
    void page, perPage, debouncedSearch, sortKey, sortDir
    fetchUsers()
  })

  // Client-side status filter
  const filtered = $derived(
    statusFilter ? users.filter(u => u.status === statusFilter) : users
  )

  const activeFilterCount = $derived(statusFilter ? 1 : 0)

  function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const columns: Column<UserType>[] = [
    {
      id: 'user',
      label: 'User',
      sortKey: 'name',
      getValue: (u) => u.name,
    },
    {
      id: 'status',
      label: 'Status',
      hideable: true,
      className: 'hidden sm:table-cell',
      cellClassName: 'hidden sm:table-cell',
      sortKey: 'status',
      getValue: (u) => u.status,
    },
    {
      id: 'created',
      label: 'Created',
      hideable: true,
      className: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell text-sm text-muted-foreground',
      sortKey: 'created_at',
      getValue: (u) => u.created_at,
    },
    {
      id: 'actions',
      label: '',
      className: 'w-10',
    },
  ]
</script>

<AuthenticatedLayout
  {currentUser}
  {appName}
  {navigate}
  activePath="/users"
>
  <Header fixed {navigate} />

  <Main>
    <div class="space-y-4">
      <!-- Title row -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-2xl font-bold tracking-tight">User List</h2>
          <p class="text-sm text-muted-foreground">
            {total > 0 ? `${total} users total.` : 'Manage your users here.'}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Mail class="mr-1.5 size-4" />
            Invite User
          </Button>
          <Button size="sm" onclick={() => addOpen = true}>
            <UserPlus class="mr-1.5 size-4" />
            Add User
          </Button>
        </div>
      </div>

      <!-- Data table -->
      <DataTable
        data={filtered}
        {columns}
        {loading}
        searchValue={search}
        onSearchChange={(v) => search = v}
        searchPlaceholder="Filter users..."
        {page}
        {perPage}
        totalItems={filteredTotal}
        onPageChange={(p) => page = p}
        onPerPageChange={(pp) => { perPage = pp; page = 1 }}
        onSortChange={(key, dir) => { sortKey = key; sortDir = dir; page = 1 }}
        selectable
        {selectedIds}
        onSelectionChange={(ids) => selectedIds = ids}
        getRowId={(u) => u.id}
        emptyMessage={search || statusFilter ? 'No users match the current filters.' : 'No users found.'}
      >
        {#snippet toolbarLeft()}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button variant="outline" size="sm" class="h-8 gap-1.5" {...props}>
                  <ListFilter class="size-3.5" />
                  Status
                  {#if statusFilter}
                    <Badge variant="secondary" class="ml-1 rounded px-1 text-[10px]">1</Badge>
                  {/if}
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" class="w-36">
              <DropdownMenu.Label>Filter by status</DropdownMenu.Label>
              <DropdownMenu.Separator />
              <DropdownMenu.CheckboxItem
                checked={statusFilter === 'active'}
                onCheckedChange={() => statusFilter = statusFilter === 'active' ? null : 'active'}
              >
                Active
              </DropdownMenu.CheckboxItem>
              <DropdownMenu.CheckboxItem
                checked={statusFilter === 'inactive'}
                onCheckedChange={() => statusFilter = statusFilter === 'inactive' ? null : 'inactive'}
              >
                Inactive
              </DropdownMenu.CheckboxItem>
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          {#if activeFilterCount > 0}
            <Button
              variant="ghost"
              size="sm"
              class="h-8 px-2"
              onclick={() => { statusFilter = null; search = '' }}
            >
              Reset
              <Badge variant="secondary" class="ml-1 rounded px-1 text-[10px]">{activeFilterCount}</Badge>
            </Button>
          {/if}
        {/snippet}

        {#snippet renderCell({ column, row, index })}
          {#if column.id === 'user'}
            <div class="flex items-center gap-3">
              <Avatar class="size-8">
                <AvatarFallback class="text-xs">{getInitials(row.name)}</AvatarFallback>
              </Avatar>
              <div class="min-w-0">
                <div class="truncate text-sm font-medium">{row.name}</div>
                <div class="truncate text-xs text-muted-foreground">{row.email}</div>
              </div>
            </div>
          {:else if column.id === 'status'}
            <Badge
              variant={row.status === 'active' ? 'default' : 'outline'}
              class="text-[10px] capitalize"
            >
              {row.status}
            </Badge>
          {:else if column.id === 'created'}
            {row.created_at
              ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '\u2014'}
          {:else if column.id === 'actions'}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button variant="ghost" size="icon" class="size-8" {...props}>
                    <MoreHorizontal class="size-4" />
                    <span class="sr-only">Open menu</span>
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" class="w-40">
                <DropdownMenu.Item onclick={() => editUser = row}>
                  <Pencil class="mr-2 size-4" />
                  Edit
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  class="text-destructive focus:text-destructive"
                  onclick={() => deleteUser = row}
                >
                  <Trash2 class="mr-2 size-4" />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          {/if}
        {/snippet}
      </DataTable>
    </div>

    <!-- CRUD Dialogs -->
    <AddUserDialog
      bind:open={addOpen}
      onSuccess={fetchUsers}
    />
    <EditUserDialog
      bind:user={editUser}
      onSuccess={fetchUsers}
    />
    <DeleteUserDialog
      bind:user={deleteUser}
      onSuccess={fetchUsers}
    />
  </Main>
</AuthenticatedLayout>
