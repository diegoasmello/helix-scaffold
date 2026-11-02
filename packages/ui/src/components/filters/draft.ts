import { OPERATORS, valueShape } from './operators'
import type {
  FilterCondition,
  FilterFieldDef,
  FilterFieldType,
  LogicalFilterValue,
} from './types'

/**
 * A condition while it is edited: values are strings (what the inputs hold);
 * `list` and `range` operators keep a string array (`range` = `[from, to]`).
 */
export interface DraftCondition {
  id: string
  field: string
  op: string
  value: string | string[]
}

export interface Draft {
  logic: 'AND' | 'OR'
  conditions: DraftCondition[]
}

let nextId = 0
const newId = () => `condition-${++nextId}`

export function fieldType(
  fields: FilterFieldDef[],
  name: string
): FilterFieldType {
  return fields.find((field) => field.name === name)?.type ?? 'text'
}

export function emptyValue(op: string): string | string[] {
  const shape = valueShape(op)
  if (shape === 'list') return []
  if (shape === 'range') return ['', '']
  return ''
}

export function newCondition(field: FilterFieldDef): DraftCondition {
  const op = OPERATORS[field.type][0].op
  return { id: newId(), field: field.name, op, value: emptyValue(op) }
}

export function toDraft(value: LogicalFilterValue): Draft {
  return {
    logic: value.logic,
    conditions: value.conditions.map((condition) => {
      const shape = valueShape(condition.op)
      const raw = condition.value
      let draftValue: string | string[] = emptyValue(condition.op)
      if (shape === 'list' || shape === 'range') {
        if (Array.isArray(raw)) draftValue = raw.map(String)
      } else if (shape === 'single' && raw != null && !Array.isArray(raw)) {
        draftValue = String(raw)
      }
      return {
        id: newId(),
        field: condition.field,
        op: condition.op,
        value: draftValue,
      }
    }),
  }
}

export function isComplete(condition: DraftCondition): boolean {
  switch (valueShape(condition.op)) {
    case 'none':
      return true
    case 'list':
      return condition.value.length > 0
    case 'range':
      return (
        Array.isArray(condition.value) &&
        condition.value.length === 2 &&
        condition.value.every((item) => item !== '')
      )
    default:
      return condition.value !== ''
  }
}

function coerce(type: FilterFieldType, raw: string): string | number | boolean {
  if (type === 'number') return Number(raw)
  if (type === 'boolean') return raw === 'true'
  return raw
}

/** The complete conditions, typed for the API. */
export function fromDraft(
  draft: Draft,
  fields: FilterFieldDef[]
): LogicalFilterValue {
  const conditions = draft.conditions
    .filter(isComplete)
    .map((condition): FilterCondition => {
      const type = fieldType(fields, condition.field)
      const { field, op, value } = condition
      switch (valueShape(op)) {
        case 'none':
          return { field, op }
        case 'list':
        case 'range':
          return {
            field,
            op,
            value: (value as string[]).map((item) =>
              type === 'number' ? Number(item) : item
            ),
          }
        default:
          return { field, op, value: coerce(type, value as string) }
      }
    })

  return { logic: draft.logic, conditions }
}
