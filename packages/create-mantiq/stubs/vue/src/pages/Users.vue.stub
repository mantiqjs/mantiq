<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import { api } from '@/lib/api'
import { AuthenticatedLayout, Header, Main } from '@/components/layout'
import DataTable from '@/components/DataTable.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Search, MoreHorizontal, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import AddUserDialog from './users/dialogs/AddUserDialog.vue'
import EditUserDialog from './users/dialogs/EditUserDialog.vue'
import DeleteUserDialog from './users/dialogs/DeleteUserDialog.vue'

const props = withDefaults(defineProps<{
  appName?: string
  currentUser?: { id: number; name: string; email: string } | null
  navigate: (href: string) => void
}>(), {
  appName: 'Mantiq',
})

interface UserRecord {
  id: number
  name: string
  email: string
  created_at?: string
}

const users = ref<UserRecord[]>([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const perPage = ref(10)
const sortBy = ref('created_at')
const sortDir = ref<'asc' | 'desc'>('desc')
const meta = ref({ total: 0, filtered_total: 0, page: 1, per_page: 10, last_page: 1 })

// Dialogs
const addOpen = ref(false)
const editOpen = ref(false)
const deleteOpen = ref(false)
const selectedUser = ref<UserRecord | null>(null)

async function fetchUsers() {
  loading.value = true
  const params = new URLSearchParams({
    search: search.value,
    page: String(page.value),
    per_page: String(perPage.value),
    sort: sortBy.value,
    dir: sortDir.value,
  })
  const { ok, data } = await api(`/api/users?${params}`)
  if (ok) {
    users.value = data.data ?? []
    meta.value = data.meta ?? meta.value
  }
  loading.value = false
}

function toggleSort(col: string) {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = col
    sortDir.value = 'asc'
  }
  page.value = 1
  fetchUsers()
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    fetchUsers()
  }, 300)
}

function openEdit(user: UserRecord) {
  selectedUser.value = user
  editOpen.value = true
}

function openDelete(user: UserRecord) {
  selectedUser.value = user
  deleteOpen.value = true
}

const columns: ColumnDef<UserRecord, any>[] = [
  {
    accessorKey: 'name',
    header: () => h('div', { class: 'flex items-center gap-1 cursor-pointer select-none', onClick: () => toggleSort('name') }, [
      'Name',
      h(ArrowUpDown, { class: 'h-3 w-3' }),
    ]),
    cell: ({ row }) => h('div', { class: 'font-medium' }, row.getValue('name') as string),
  },
  {
    accessorKey: 'email',
    header: () => h('div', { class: 'flex items-center gap-1 cursor-pointer select-none', onClick: () => toggleSort('email') }, [
      'Email',
      h(ArrowUpDown, { class: 'h-3 w-3' }),
    ]),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const user = row.original
      return h(DropdownMenu, null, {
        default: () => [
          h(DropdownMenuTrigger, { asChild: true }, () =>
            h(Button, { variant: 'ghost', size: 'icon', class: 'h-8 w-8' }, () =>
              h(MoreHorizontal, { class: 'h-4 w-4' }),
            ),
          ),
          h(DropdownMenuContent, { align: 'end' }, () => [
            h(DropdownMenuItem, { onSelect: () => openEdit(user) }, () => 'Edit'),
            h(DropdownMenuItem, { variant: 'destructive', onSelect: () => openDelete(user) }, () => 'Delete'),
          ]),
        ],
      })
    },
  },
]

onMounted(fetchUsers)
</script>

<template>
  <AuthenticatedLayout
    :current-user="currentUser"
    :app-name="appName"
    :navigate="navigate"
    active-path="/users"
  >
    <Header :navigate="navigate" />
    <Main>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-3xl font-bold tracking-tight">Users</h2>
          <Button class="gap-2" @click="addOpen = true">
            <Plus class="h-4 w-4" />
            Add User
          </Button>
        </div>

        <!-- Search -->
        <div class="flex items-center gap-2">
          <div class="relative max-w-sm flex-1">
            <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="search"
              placeholder="Search users..."
              class="pl-9"
              @input="onSearchInput"
            />
          </div>
          <span class="text-sm text-muted-foreground">
            {{ loading ? 'Loading...' : `${meta.filtered_total} of ${meta.total} users` }}
          </span>
        </div>

        <!-- Table -->
        <DataTable :columns="columns" :data="users" />

        <!-- Pagination -->
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted-foreground">
            Page {{ meta.page }} of {{ meta.last_page }}
          </p>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="meta.page <= 1"
              @click="page--; fetchUsers()"
            >
              <ChevronLeft class="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="meta.page >= meta.last_page"
              @click="page++; fetchUsers()"
            >
              Next
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Main>

    <!-- Dialogs -->
    <AddUserDialog v-model:open="addOpen" @created="fetchUsers" />
    <EditUserDialog v-model:open="editOpen" :user="selectedUser" @updated="fetchUsers" />
    <DeleteUserDialog v-model:open="deleteOpen" :user="selectedUser" @deleted="fetchUsers" />
  </AuthenticatedLayout>
</template>
