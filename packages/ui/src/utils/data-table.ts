type SearchNavigateFn<TSearch> = (opts: {
  search: (prev: TSearch) => TSearch
}) => unknown

export function getDataTablePaginationProps<
  TSearch extends { page: number; pageSize: number },
>(
  response: { total: number },
  search: TSearch,
  navigate: SearchNavigateFn<TSearch>
) {
  return {
    totalRecords: response.total,
    page: search.page,
    onPageChange: (newPage: number) =>
      navigate({ search: (prev) => ({ ...prev, page: newPage }) }),
    recordsPerPage: search.pageSize,
    recordsPerPageOptions: [5, 10, 15, 20],
    onRecordsPerPageChange: (newPageSize: number) =>
      navigate({
        search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }),
      }),
  }
}

type SortStatus = {
  columnAccessor: string
  direction: 'asc' | 'desc'
}

export function getDataTableSortingProps<
  TSortColumn extends string,
  TSearch extends {
    sortBy?: TSortColumn
    sortOrder: 'asc' | 'desc'
    page: number
  },
>(search: TSearch, navigate: SearchNavigateFn<TSearch>) {
  return {
    sortStatus: search.sortBy
      ? ({
          columnAccessor: search.sortBy,
          direction: search.sortOrder,
        } satisfies SortStatus)
      : undefined,
    onSortStatusChange: (s: SortStatus) =>
      navigate({
        search: (prev) => ({
          ...prev,
          sortBy: s.columnAccessor as TSortColumn,
          sortOrder: s.direction,
          page: 1,
        }),
      }),
  }
}
