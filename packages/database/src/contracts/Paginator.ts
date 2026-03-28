export interface PaginationResult<T = Record<string, any>> {
  data: T[]
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  from: number
  to: number
  hasMore: boolean
}

export interface CursorPaginationResult<T = Record<string, any>> {
  data: T[]
  next_cursor: string | number | null
  prev_cursor: string | number | null
  per_page: number
  has_more: boolean
}
