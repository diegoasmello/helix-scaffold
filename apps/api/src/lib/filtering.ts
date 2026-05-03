import {
  and,
  type AnyColumn,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  type SQL,
} from 'drizzle-orm'
import z from 'zod'

export const FILTER_OPERATORS = [
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
] as const
export type FilterOperator = (typeof FILTER_OPERATORS)[number]

export const filterOperatorSchema = z.enum(FILTER_OPERATORS)
export const filterLogicSchema = z.enum(['AND', 'OR'])
export type FilterLogic = z.infer<typeof filterLogicSchema>

const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

const filterArrayValueSchema = z.array(z.union([z.string(), z.number()]))

export const filterConditionSchema = z.object({
  field: z.string(),
  op: filterOperatorSchema,
  value: z.union([filterValueSchema, filterArrayValueSchema]).optional(),
})

export type FilterCondition = z.infer<typeof filterConditionSchema>

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
    value: z.union([filterValueSchema, filterArrayValueSchema]).optional(),
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
    value?: FilterCondition['value']
  }>
  filterLogic: FilterLogic
}

/**
 * Builds a Drizzle SQL WHERE clause from a list of filter conditions and an AND/OR logic.
 * Returns undefined when the conditions list is empty (no WHERE applied).
 *
 * The optional `coerce` map transforms raw filter values before they are passed to Drizzle.
 * Use it for columns whose DB type differs from the serialized URL value — e.g. timestamp
 * columns where the filter value arrives as an ISO string: `{ date: (v) => new Date(v) }`.
 */
export function buildFilterWhereClause<T extends string>(
  conditions: FilterQuery<T>['filters'],
  logic: FilterLogic,
  columnMap: Record<T, AnyColumn>,
  coerce?: Partial<Record<T, (value: unknown) => unknown>>
): SQL | undefined {
  if (conditions.length === 0) return undefined

  const sqlConditions: SQL[] = []

  for (const { field, op, value } of conditions) {
    const col = columnMap[field]
    if (!col) continue

    const coerceFn = coerce?.[field]
    const coercedValue = coerceFn && value != null ? coerceFn(value) : value

    switch (op) {
      case 'eq':
        if (coercedValue != null) sqlConditions.push(eq(col, coercedValue))
        break
      case 'neq':
        if (coercedValue != null) sqlConditions.push(ne(col, coercedValue))
        break
      case 'contains':
        if (typeof coercedValue === 'string')
          sqlConditions.push(ilike(col, `%${coercedValue}%`))
        break
      case 'startsWith':
        if (typeof coercedValue === 'string')
          sqlConditions.push(ilike(col, `${coercedValue}%`))
        break
      case 'endsWith':
        if (typeof coercedValue === 'string')
          sqlConditions.push(ilike(col, `%${coercedValue}`))
        break
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
    }
  }

  if (sqlConditions.length === 0) return undefined
  if (sqlConditions.length === 1) return sqlConditions[0]
  return logic === 'AND' ? and(...sqlConditions) : or(...sqlConditions)
}
