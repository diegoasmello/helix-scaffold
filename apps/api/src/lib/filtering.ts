import {
  and,
  type AnyColumn,
  between,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  type SQL,
} from 'drizzle-orm'
import z from 'zod'

import { normalizeText } from './normalize-text'

const FILTER_OPERATORS = [
  'eq',
  'neq',
  'contains',
  'startsWith',
  'endsWith',
  'gt',
  'gte',
  'lt',
  'lte',
  'isNull',
  'isNotNull',
  'in',
  'between',
] as const
type FilterOperator = (typeof FILTER_OPERATORS)[number]

const filterOperatorSchema = z.enum(FILTER_OPERATORS)
const filterLogicSchema = z.enum(['AND', 'OR'])
export type FilterLogic = z.infer<typeof filterLogicSchema>

const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

const filterArrayValueSchema = z.array(z.union([z.string(), z.number()]))

const filterConditionValueSchema = z.union([
  filterValueSchema,
  filterArrayValueSchema,
])

/**
 * Factory that creates a Zod schema for filter query params scoped to a module's allowed fields.
 * `filters` is accepted as a JSON-encoded string and transformed to a typed array on validation.
 * Invalid JSON is silently treated as an empty filter list.
 */
export function filterQuerySchema<T extends string>(
  allowedFields: readonly [T, ...T[]]
) {
  const fieldSchema = z.enum(allowedFields)
  const conditionSchema = z.object({
    field: fieldSchema,
    op: filterOperatorSchema,
    value: filterConditionValueSchema.optional(),
  })

  return z.object({
    filters: z
      .string()
      .optional()
      .transform((v): z.infer<typeof conditionSchema>[] => {
        if (!v) return []
        try {
          return z.array(conditionSchema).parse(JSON.parse(v))
        } catch {
          return []
        }
      }),
    filterLogic: filterLogicSchema.default('AND'),
  })
}

export type FilterQuery<T extends string = string> = {
  filters: Array<{
    field: T
    op: FilterOperator
    value?: z.infer<typeof filterConditionValueSchema>
  }>
  filterLogic: FilterLogic
}

export interface FilterWhereOptions<T extends string> {
  /**
   * Transforms raw filter values before they are passed to Drizzle. Use it
   * for columns whose DB type differs from the serialized URL value — e.g.
   * timestamp columns where the value arrives as an ISO string:
   * `{ date: (v) => new Date(v) }`. Runs on each item of an array value.
   */
  coerce?: Partial<Record<T, (value: unknown) => unknown>>
  /**
   * The normalized column of a text field (`{ title: todos.normalizedTitle }`).
   * `contains`, `startsWith` and `endsWith` on that field then compare the
   * normalized value with it (accent-, case- and whitespace-insensitive);
   * `eq`, `neq` and `in` stay exact on the column of `columnMap`.
   */
  normalized?: Partial<Record<T, AnyColumn>>
}

/** Escapes LIKE wildcards so `50%` or `a_b` match literally. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`)
}

type TextOperator = 'contains' | 'startsWith' | 'endsWith'

function likePattern(op: TextOperator, value: string): string {
  const escaped = escapeLike(value)
  if (op === 'startsWith') return `${escaped}%`
  if (op === 'endsWith') return `%${escaped}`
  return `%${escaped}%`
}

/**
 * A text operator on one field: on its normalized column when it has one
 * (both sides normalized, so a plain `LIKE`), else `ILIKE` on the column.
 */
function textCondition(
  op: TextOperator,
  value: string,
  column: AnyColumn,
  normalizedColumn: AnyColumn | undefined
): SQL | undefined {
  if (!normalizedColumn) return ilike(column, likePattern(op, value))
  const term = normalizeText(value)
  if (!term) return undefined
  return like(normalizedColumn, likePattern(op, term))
}

/**
 * Builds a Drizzle SQL WHERE clause from a list of filter conditions and an AND/OR logic.
 * Returns undefined when the conditions list is empty (no WHERE applied).
 * See `FilterWhereOptions` for `coerce` and `normalized`.
 */
export function buildFilterWhereClause<T extends string>(
  conditions: FilterQuery<T>['filters'],
  logic: FilterLogic,
  columnMap: Record<T, AnyColumn>,
  options: FilterWhereOptions<T> = {}
): SQL | undefined {
  if (conditions.length === 0) return undefined

  const { coerce, normalized } = options
  const sqlConditions: SQL[] = []

  for (const { field, op, value } of conditions) {
    const col = columnMap[field]
    if (!col) continue

    // Array values (`in`, `between`) are coerced item by item.
    const coerceFn = coerce?.[field]
    const coercedValue =
      coerceFn && value != null
        ? Array.isArray(value)
          ? value.map((item) => coerceFn(item))
          : coerceFn(value)
        : value

    switch (op) {
      case 'eq':
        if (coercedValue != null) sqlConditions.push(eq(col, coercedValue))
        break
      case 'neq':
        if (coercedValue != null) sqlConditions.push(ne(col, coercedValue))
        break
      case 'contains':
      case 'startsWith':
      case 'endsWith': {
        const condition =
          typeof coercedValue === 'string'
            ? textCondition(op, coercedValue, col, normalized?.[field])
            : undefined
        if (condition) sqlConditions.push(condition)
        break
      }
      case 'gt':
        if (coercedValue != null) sqlConditions.push(gt(col, coercedValue))
        break
      case 'gte':
        if (coercedValue != null) sqlConditions.push(gte(col, coercedValue))
        break
      case 'lt':
        if (coercedValue != null) sqlConditions.push(lt(col, coercedValue))
        break
      case 'lte':
        if (coercedValue != null) sqlConditions.push(lte(col, coercedValue))
        break
      case 'isNull':
        sqlConditions.push(isNull(col))
        break
      case 'isNotNull':
        sqlConditions.push(isNotNull(col))
        break
      case 'in':
        if (Array.isArray(coercedValue) && coercedValue.length > 0)
          sqlConditions.push(inArray(col, coercedValue))
        break
      case 'between':
        // Inclusive on both ends: `[from, to]`.
        if (
          Array.isArray(coercedValue) &&
          coercedValue.length === 2 &&
          coercedValue.every((item) => item != null && item !== '')
        )
          sqlConditions.push(between(col, coercedValue[0], coercedValue[1]))
        break
    }
  }

  if (sqlConditions.length === 0) return undefined
  if (sqlConditions.length === 1) return sqlConditions[0]
  return logic === 'AND' ? and(...sqlConditions) : or(...sqlConditions)
}

const calendarDaySchema = z.iso.date()

/**
 * `coerce` for a `date` column (a calendar day): keeps a `YYYY-MM-DD` value
 * and turns anything else into `null`, which skips the condition — an invalid
 * date never reaches Postgres (a 500). `{ date: coerceCalendarDay }`.
 */
export function coerceCalendarDay(value: unknown): string | null {
  return typeof value === 'string' && calendarDaySchema.safeParse(value).success
    ? value
    : null
}

/**
 * `search`: free text a list matches against a few text columns (the list
 * screen's search box). Blank becomes `undefined`; capped at 200 characters.
 */
export const searchQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
})

/**
 * Accent-, case- and whitespace-insensitive "contains" of `term` in any of
 * `normalizedColumns`, or `undefined` without a term. The columns must be
 * normalized ones (`todos.normalizedTitle`, written with `normalizeText`):
 * the term is normalized here and compared with a plain `LIKE`. Combine it
 * with the filter clause: `and(filters, search)`.
 */
export function buildSearchClause(
  term: string | undefined,
  normalizedColumns: AnyColumn[]
): SQL | undefined {
  if (!term || normalizedColumns.length === 0) return undefined
  const normalized = normalizeText(term)
  if (!normalized) return undefined
  const pattern = likePattern('contains', normalized)
  return or(...normalizedColumns.map((column) => like(column, pattern)))
}
