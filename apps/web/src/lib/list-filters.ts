import type { FilterCondition, LogicalFilterValue } from '@helix/ui'
import { z } from 'zod'

const filterConditionSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      // `in` lists and `between` [from, to] pairs
      z.array(z.union([z.string(), z.number()])),
    ])
    .optional(),
})

const filterConditionsSchema = z.array(filterConditionSchema)

/**
 * Reads the `filters` search param (a JSON-encoded `FilterCondition[]`).
 * Anything else — malformed JSON, a non-array, a condition without `field`/`op`
 * — yields no conditions instead of throwing, so a hand-edited or truncated
 * URL loads the list unfiltered.
 */
export function parseFilterConditions(
  filters: string | undefined
): FilterCondition[] {
  if (!filters) return []
  try {
    const result = filterConditionsSchema.safeParse(JSON.parse(filters))
    return result.success ? result.data : []
  } catch {
    return []
  }
}

/**
 * `validateSearch` entry for a list route's `filters` param. TanStack Router
 * JSON-parses search values, so a hand-typed `?filters=[...]` arrives as an
 * array and `?filters=1` as a number: both are re-encoded to the string the
 * app expects. A value that is not a valid condition list becomes `undefined`.
 */
export const filtersSearchParam = z
  .unknown()
  .optional()
  .transform((raw): string | undefined => {
    if (raw === undefined || raw === null) return undefined
    const encoded = typeof raw === 'string' ? raw : JSON.stringify(raw)
    return parseFilterConditions(encoded).length > 0 ? encoded : undefined
  })

/**
 * `validateSearch` entry for a list route's `search` param (the search box).
 * TanStack Router JSON-parses search values, so `?search=2026` arrives as a
 * number: it is turned back into text. Blank becomes `undefined`; anything
 * past the API's 200 characters is cut.
 */
export const searchSearchParam = z
  .unknown()
  .optional()
  .transform((raw): string | undefined => {
    if (typeof raw !== 'string' && typeof raw !== 'number') return undefined
    const text = String(raw).trim().slice(0, 200)
    return text || undefined
  })

interface FilterSearch {
  filters?: string
  filterLogic: 'AND' | 'OR'
  search?: string
  page: number
}

type SearchNavigateFn<TSearch> = (opts: {
  search: (prev: TSearch) => TSearch
}) => unknown

export interface FilterBarBindings {
  value: LogicalFilterValue
  onChange: (next: LogicalFilterValue) => void
  /** Only when the route has a `search` param — the search box's state. */
  search?: { value: string; onChange: (next: string) => void }
  /** Filters or a search narrow the list (for the "no results" state). */
  active: boolean
  /** Drops the filters and the search at once. */
  clearAll: () => void
}

/**
 * `FilterBar` props for a list route whose search holds `filters`,
 * `filterLogic` and optionally `search` — like `getDataTablePaginationProps`
 * for the table. Every change rewrites the params and goes back to page 1;
 * no conditions (or a blank search) removes the param from the URL.
 */
export function getFilterBarProps<TSearch extends FilterSearch>(
  search: TSearch,
  navigate: SearchNavigateFn<TSearch>,
  options: { withSearch?: boolean } = {}
): FilterBarBindings {
  const conditions = parseFilterConditions(search.filters)

  return {
    active: conditions.length > 0 || Boolean(search.search),
    clearAll: () =>
      navigate({
        search: (prev) => ({
          ...prev,
          filters: undefined,
          search: undefined,
          page: 1,
        }),
      }),
    ...(options.withSearch && {
      search: {
        value: search.search ?? '',
        onChange: (next: string) =>
          navigate({
            search: (prev) => ({
              ...prev,
              search: next.trim() || undefined,
              page: 1,
            }),
          }),
      },
    }),
    value: {
      conditions,
      logic: search.filterLogic,
    },
    onChange: (next) =>
      navigate({
        search: (prev) => ({
          ...prev,
          filters:
            next.conditions.length > 0
              ? JSON.stringify(next.conditions)
              : undefined,
          filterLogic: next.logic,
          page: 1,
        }),
      }),
  }
}
