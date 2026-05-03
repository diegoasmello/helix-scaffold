export type FilterFieldType = 'text' | 'number' | 'boolean' | 'date' | 'select'

export interface FilterFieldDef<T extends string = string> {
  name: T
  label: string
  type: FilterFieldType
  options?: Array<{ value: string; label: string }>
}

export interface FilterCondition {
  field: string
  op: string
  value?: string | number | boolean | null | string[]
}

export interface LogicalFilterValue {
  conditions: FilterCondition[]
  logic: 'AND' | 'OR'
}
