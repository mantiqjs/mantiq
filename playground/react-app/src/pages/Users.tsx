import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../lib/api.ts'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  UserPlus,
  Mail,
  Pencil,
  Trash2,
  ListFilter,
} from 'lucide-react'
import { DataTable } from '@/components/data-table'
import type { Column } from '@/components/data-table'
import { AddUserDialog, EditUserDialog, DeleteUserDialog } from './users/dialogs'
import type { UserType } from './users/dialogs'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UsersProps {
  appName?: string
  currentUser?: { id: number; name: string; email: string } | null
  users?: UserType[]
  navigate: (href: string) => void
  [key: string]: any
}

// ---------------------------------------------------------------------------
// Mock data (25 realistic users)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsersPage({
  appName = 'MantiqJS',
  currentUser,
  users: initialUsers,
  navigate,
}: UsersProps) {
  // Data
  const [users, setUsers] = useState<UserType[]>(() => {
    if (initialUsers && initialUsers.length > 0) {
      return initialUsers.map((u) => ({
        ...u,
        status: (u as any).status ?? 'active',
        created_at: u.created_at ?? '',
      }))
    }
    return mockUsers
  })
  const [loading, setLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set())

  // Server-side pagination + sort
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sortKey, setSortKey] = useState<string | null>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [total, setTotal] = useState(0)
  const [filteredTotal, setFilteredTotal] = useState(0)

  // CRUD dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserType | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserType | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch from API — server-side search + pagination
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      sort: sortKey ?? 'created_at',
      dir: sortDir,
    })
    if (debouncedSearch) params.set('search', debouncedSearch)

    const { ok, data } = await api(`/api/users?${params}`)
    if (ok && data) {
      setUsers(
        (data.data as any[]).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          status: u.status ?? 'active',
          created_at: u.created_at ?? '',
        })),
      )
      if (data.meta) {
        setTotal(data.meta.total)
        setFilteredTotal(data.meta.filtered_total)
      }
    }
    setLoading(false)
    setSelectedIds(new Set())
  }, [page, perPage, debouncedSearch, sortKey, sortDir])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Client-side status filter (applied on top of server results)
  const filtered = useMemo(() => {
    if (!statusFilter) return users
    return users.filter((u) => u.status === statusFilter)
  }, [users, statusFilter])

  // Active filter count for toolbar indicator
  const activeFilterCount = statusFilter ? 1 : 0

  // ---- Column definitions --------------------------------------------------

  const columns: Column<UserType>[] = useMemo(
    () => [
      {
        id: 'user',
        label: 'User',
        sortKey: 'name',
        getValue: (u) => u.name,
        render: (u) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {getInitials(u.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{u.name}</div>
              <div className="truncate text-xs text-muted-foreground">{u.email}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        hideable: true,
        className: 'hidden sm:table-cell',
        cellClassName: 'hidden sm:table-cell',
        sortKey: 'status',
        getValue: (u) => u.status,
        render: (u) => (
          <Badge
            variant={u.status === 'active' ? 'default' : 'outline'}
            className="text-[10px] capitalize"
          >
            {u.status}
          </Badge>
        ),
      },
      {
        id: 'created',
        label: 'Created',
        hideable: true,
        className: 'hidden lg:table-cell',
        cellClassName: 'hidden lg:table-cell text-sm text-muted-foreground',
        sortKey: 'created_at',
        getValue: (u) => u.created_at,
        render: (u) =>
          u.created_at
            ? new Date(u.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '\u2014',
      },
      {
        id: 'actions',
        label: '',
        className: 'w-10',
        render: (u) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setEditUser(u)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteUser(u)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  )

  // ---- Toolbar slots -------------------------------------------------------

  const statusFilterSlot = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <ListFilter className="size-3.5" />
            Status
            {statusFilter && (
              <Badge variant="secondary" className="ml-1 rounded px-1 text-[10px]">
                1
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={statusFilter === 'active'}
            onCheckedChange={() =>
              setStatusFilter((f) => (f === 'active' ? null : 'active'))
            }
          >
            Active
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={statusFilter === 'inactive'}
            onCheckedChange={() =>
              setStatusFilter((f) => (f === 'inactive' ? null : 'inactive'))
            }
          >
            Inactive
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            setStatusFilter(null)
            setSearch('')
          }}
        >
          Reset
          <Badge variant="secondary" className="ml-1 rounded px-1 text-[10px]">
            {activeFilterCount}
          </Badge>
        </Button>
      )}
    </>
  )

  // ---- Render --------------------------------------------------------------

  return (
    <AuthenticatedLayout
      currentUser={currentUser}
      appName={appName}
      navigate={navigate}
      activePath="/users"
    >
      <Header fixed navigate={navigate} />

      <Main>
        <div className="space-y-4">
          {/* Title row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">User List</h2>
              <p className="text-sm text-muted-foreground">
                {total > 0 ? `${total} users total.` : 'Manage your users here.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <Mail className="mr-1.5 size-4" />
                Invite User
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="mr-1.5 size-4" />
                Add User
              </Button>
            </div>
          </div>

          {/* Data table */}
          <DataTable<UserType>
            data={filtered}
            columns={columns}
            loading={loading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Filter users..."
            page={page}
            perPage={perPage}
            totalItems={filteredTotal}
            onPageChange={setPage}
            onPerPageChange={(pp) => { setPerPage(pp); setPage(1) }}
            onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1) }}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            getRowId={(u) => u.id}
            toolbarLeft={statusFilterSlot}
            emptyMessage={
              search || statusFilter
                ? 'No users match the current filters.'
                : 'No users found.'
            }
          />
        </div>

        {/* CRUD Dialogs */}
        <AddUserDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={fetchUsers}
        />
        <EditUserDialog
          user={editUser}
          onOpenChange={(open) => { if (!open) setEditUser(null) }}
          onSuccess={fetchUsers}
        />
        <DeleteUserDialog
          user={deleteUser}
          onOpenChange={(open) => { if (!open) setDeleteUser(null) }}
          onSuccess={fetchUsers}
        />
      </Main>
    </AuthenticatedLayout>
  )
}
