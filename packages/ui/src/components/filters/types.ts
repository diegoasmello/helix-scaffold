export type FilterFieldType = 'text' | 'number' | 'boolean' | 'date' | 'select'

export interface FilterFieldDef<T extends string = string> {
  name: T
  label: string
  type: FilterFieldType
  /** Only for `select` fields. */
  options?: Array<{ value: string; label: string }>
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isNull'
  | 'isNotNull'
  | 'in'
  | 'between'

/** One condition as the API receives it (`filters` query param). */
export interface FilterCondition {
  field: string
  op: string
  /**
   * Scalar for most operators; `in` takes a list, `between` a `[from, to]`
   * pair; `isNull`/`isNotNull` take none.
   */
  value?: string | number | boolean | null | Array<string | number>
}

export interface LogicalFilterValue {
  conditions: FilterCondition[]
  logic: 'AND' | 'OR'
}
