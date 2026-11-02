import type { FilterFieldType, FilterOperator } from './types'

/** `ui:filters.ops.*` keys — the same `eq` reads differently per type. */
export type OperatorLabel =
  | 'contains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'on'
  | 'from'
  | 'until'
  | 'after'
  | 'before'
  | 'is'
  | 'isNot'
  | 'isAnyOf'

export interface OperatorDef {
  op: FilterOperator
  label: OperatorLabel
}

/** The operators offered for each field type, the first one by default. */
export const OPERATORS: Record<FilterFieldType, OperatorDef[]> = {
  text: [
    { op: 'contains', label: 'contains' },
    { op: 'eq', label: 'equals' },
    { op: 'neq', label: 'notEquals' },
    { op: 'startsWith', label: 'startsWith' },
    { op: 'endsWith', label: 'endsWith' },
    { op: 'isNull', label: 'isEmpty' },
    { op: 'isNotNull', label: 'isNotEmpty' },
  ],
  number: [
    { op: 'eq', label: 'equals' },
    { op: 'neq', label: 'notEquals' },
    { op: 'gt', label: 'gt' },
    { op: 'gte', label: 'gte' },
    { op: 'lt', label: 'lt' },
    { op: 'lte', label: 'lte' },
    { op: 'between', label: 'between' },
    { op: 'isNull', label: 'isEmpty' },
    { op: 'isNotNull', label: 'isNotEmpty' },
  ],
  date: [
    { op: 'between', label: 'between' },
    { op: 'gte', label: 'from' },
    { op: 'lte', label: 'until' },
    { op: 'eq', label: 'on' },
    { op: 'gt', label: 'after' },
    { op: 'lt', label: 'before' },
    { op: 'isNull', label: 'isEmpty' },
    { op: 'isNotNull', label: 'isNotEmpty' },
  ],
  select: [
    { op: 'eq', label: 'is' },
    { op: 'neq', label: 'isNot' },
    { op: 'in', label: 'isAnyOf' },
    { op: 'isNull', label: 'isEmpty' },
    { op: 'isNotNull', label: 'isNotEmpty' },
  ],
  boolean: [{ op: 'eq', label: 'is' }],
}

/** How an operator's value is entered. */
export type ValueShape = 'none' | 'single' | 'list' | 'range'

export function valueShape(op: string): ValueShape {
  if (op === 'isNull' || op === 'isNotNull') return 'none'
  if (op === 'in') return 'list'
  if (op === 'between') return 'range'
  return 'single'
}

/** The operator's label key, or `undefined` for an operator the type lacks. */
export function operatorLabelKey(
  type: FilterFieldType,
  op: string
): `filters.ops.${OperatorLabel}` | undefined {
  const def = OPERATORS[type].find((item) => item.op === op)
  return def ? `filters.ops.${def.label}` : undefined
}
