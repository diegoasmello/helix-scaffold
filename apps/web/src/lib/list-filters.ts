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

interface FilterSearch {
  filters?: string
  filterLogic: 'AND' | 'OR'
  page: number
}

type SearchNavigateFn<TSearch> = (opts: {
  search: (prev: TSearch) => TSearch
}) => unknown

/**
 * `FilterBar` props for a list route whose search holds `filters` and
 * `filterLogic` — like `getDataTablePaginationProps` for the table. Every
 * change rewrites both params and goes back to page 1; no conditions removes
 * `filters` from the URL.
 */
export function getFilterBarProps<TSearch extends FilterSearch>(
  search: TSearch,
  navigate: SearchNavigateFn<TSearch>
): { value: LogicalFilterValue; onChange: (next: LogicalFilterValue) => void } {
  return {
    value: {
      conditions: parseFilterConditions(search.filters),
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
