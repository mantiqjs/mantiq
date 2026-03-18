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
