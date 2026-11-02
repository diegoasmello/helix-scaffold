import type { FilterCondition } from '@helix/ui'
import { z } from 'zod'

const filterConditionSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
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
