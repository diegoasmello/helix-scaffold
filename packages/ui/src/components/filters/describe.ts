import type { TFunction } from 'i18next'

import { operatorLabelKey, valueShape } from './operators'
import type { FilterCondition, FilterFieldDef } from './types'

export interface ConditionText {
  field: string
  op: string
  /** Empty for `isNull`/`isNotNull`. */
  value: string
}

function formatDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale).format(date)
}

/**
 * A condition in words — "Status" "is" "Pending", "Date" "is between"
 * "10/1/2026 and 10/31/2026" — for chips and accessible names.
 */
export function describeCondition(
  condition: FilterCondition,
  fields: FilterFieldDef[],
  t: TFunction<'ui'>,
  locale: string
): ConditionText {
  const field = fields.find((item) => item.name === condition.field)
  const type = field?.type ?? 'text'

  const formatOne = (raw: unknown): string => {
    const text = String(raw)
    if (type === 'select')
      return field?.options?.find((o) => o.value === text)?.label ?? text
    if (type === 'boolean')
      return text === 'true'
        ? t('filters.booleanTrue')
        : t('filters.booleanFalse')
    if (type === 'date') return formatDate(text, locale)
    return text
  }

  const raw = condition.value
  let value = ''
  switch (valueShape(condition.op)) {
    case 'list':
      value = Array.isArray(raw) ? raw.map(formatOne).join(', ') : ''
      break
    case 'range':
      value = Array.isArray(raw)
        ? t('filters.rangeValue', {
            from: formatOne(raw[0]),
            to: formatOne(raw[1]),
          })
        : ''
      break
    case 'single':
      value = raw == null ? '' : formatOne(raw)
      break
  }

  const opKey = operatorLabelKey(type, condition.op)

  return {
    field: field?.label ?? condition.field,
    op: opKey ? t(opKey) : condition.op,
    value,
  }
}

export function conditionSentence(text: ConditionText): string {
  return [text.field, text.op, text.value].filter(Boolean).join(' ')
}
