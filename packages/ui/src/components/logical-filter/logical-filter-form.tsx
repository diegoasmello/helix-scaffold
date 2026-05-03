import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm, type UseFormReturnType } from '@mantine/form'
import { IconPlus, IconX } from '@tabler/icons-react'

import { Form } from '../form/form'
import type {
  FilterCondition,
  FilterFieldDef,
  FilterFieldType,
  LogicalFilterValue,
} from './types'

const OPERATORS_BY_TYPE: Record<
  FilterFieldType,
  Array<{ value: string; label: string }>
> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'isNull', label: 'is empty' },
    { value: 'isNotNull', label: 'is not empty' },
  ],
  number: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
    { value: 'isNull', label: 'is empty' },
    { value: 'isNotNull', label: 'is not empty' },
  ],
  date: [
    { value: 'gte', label: 'on or after' },
    { value: 'lte', label: 'on or before' },
    { value: 'gt', label: 'after' },
    { value: 'lt', label: 'before' },
    { value: 'eq', label: 'on' },
    { value: 'isNull', label: 'is empty' },
    { value: 'isNotNull', label: 'is not empty' },
  ],
  select: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'isNull', label: 'is empty' },
    { value: 'isNotNull', label: 'is not empty' },
  ],
  boolean: [
    { value: 'eq', label: 'is' },
    { value: 'isNull', label: 'is empty' },
    { value: 'isNotNull', label: 'is not empty' },
  ],
}

const NO_VALUE_OPS = new Set(['isNull', 'isNotNull'])

interface FilterFormValues {
  logic: 'AND' | 'OR'
  conditions: Array<{ field: string; op: string; value: string }>
}

export interface LogicalFilterFormProps<T extends string = string> {
  fields: FilterFieldDef<T>[]
  value: LogicalFilterValue
  onApply: (value: LogicalFilterValue) => void
}

interface ValueInputProps {
  condition: { field: string; op: string; value: string }
  index: number
  fields: FilterFieldDef<string>[]
  form: UseFormReturnType<FilterFormValues>
}

function ValueInput(props: Readonly<ValueInputProps>) {
  const { condition, index, fields, form } = props
  const fieldDef = fields.find((f) => f.name === condition.field)
  if (!fieldDef) return null

  const commonProps = { size: 'xs' as const, style: { flex: 1, minWidth: 140 } }

  switch (fieldDef.type) {
    case 'text':
      return (
        <TextInput
          {...commonProps}
          placeholder="Value"
          {...form.getInputProps(`conditions.${index}.value`)}
        />
      )

    case 'number':
      return (
        <NumberInput
          {...commonProps}
          placeholder="Value"
          value={condition.value ? Number(condition.value) : ''}
          onChange={(v) =>
            form.setFieldValue(`conditions.${index}.value`, String(v))
          }
          error={form.getInputProps(`conditions.${index}.value`).error}
        />
      )

    case 'date':
      return (
        <DateInput
          {...commonProps}
          placeholder="Value"
          value={condition.value || null}
          onChange={(date) =>
            form.setFieldValue(`conditions.${index}.value`, date ?? '')
          }
          error={form.getInputProps(`conditions.${index}.value`).error}
        />
      )

    case 'select':
      return (
        <Select
          {...commonProps}
          placeholder="Value"
          data={fieldDef.options ?? []}
          value={condition.value || null}
          onChange={(v) =>
            form.setFieldValue(`conditions.${index}.value`, v ?? '')
          }
          error={form.getInputProps(`conditions.${index}.value`).error}
          allowDeselect={false}
        />
      )

    case 'boolean':
      return (
        <Select
          {...commonProps}
          placeholder="Value"
          data={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          value={condition.value || null}
          onChange={(v) =>
            form.setFieldValue(`conditions.${index}.value`, v ?? '')
          }
          error={form.getInputProps(`conditions.${index}.value`).error}
          allowDeselect={false}
        />
      )

    default:
      return null
  }
}

export function LogicalFilterForm<T extends string = string>(
  props: Readonly<LogicalFilterFormProps<T>>
) {
  const { fields, value, onApply } = props

  const form = useForm<FilterFormValues>({
    initialValues: {
      logic: value.logic,
      conditions: value.conditions.map((c) => ({
        field: c.field,
        op: c.op,
        value: c.value != null ? String(c.value) : '',
      })),
    },
  })

  const getFieldType = (fieldName: string): FilterFieldType =>
    fields.find((f) => f.name === fieldName)?.type ?? 'text'

  const getDefaultOp = (type: FilterFieldType) =>
    OPERATORS_BY_TYPE[type][0].value

  const handleFieldChange = (index: number, fieldName: string) => {
    form.setFieldValue(`conditions.${index}.field`, fieldName)
    form.setFieldValue(
      `conditions.${index}.op`,
      getDefaultOp(getFieldType(fieldName))
    )
    form.setFieldValue(`conditions.${index}.value`, '')
  }

  const handleOpChange = (index: number, op: string) => {
    form.setFieldValue(`conditions.${index}.op`, op)
    if (NO_VALUE_OPS.has(op)) {
      form.setFieldValue(`conditions.${index}.value`, '')
    }
  }

  const handleAddCondition = () => {
    const defaultField = fields[0]
    if (!defaultField) return
    form.insertListItem('conditions', {
      field: defaultField.name,
      op: getDefaultOp(defaultField.type),
      value: '',
    })
  }

  const handleSubmit = (values: FilterFormValues) => {
    const conditions: FilterCondition[] = values.conditions.flatMap(
      (c): FilterCondition[] => {
        if (!c.field || !c.op) return []

        if (NO_VALUE_OPS.has(c.op)) return [{ field: c.field, op: c.op }]

        if (!c.value) return []

        const fieldType = getFieldType(c.field)
        let coercedValue: FilterCondition['value'] = c.value

        if (fieldType === 'number') {
          const n = parseFloat(c.value)
          if (isNaN(n)) return []
          coercedValue = n
        } else if (fieldType === 'boolean') {
          coercedValue = c.value === 'true'
        }

        return [{ field: c.field, op: c.op, value: coercedValue }]
      }
    )

    onApply({ logic: values.logic, conditions })
  }

  const handleClear = () => {
    form.setValues({ logic: 'AND', conditions: [] })
    onApply({ logic: 'AND', conditions: [] })
  }

  return (
    <Form form={form} onSubmit={handleSubmit} blockNavitationOnDirty={false}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs" align="center">
            <Text size="sm" fw={500} c="dimmed">
              Match
            </Text>
            <Select
              size="xs"
              w={190}
              data={[
                { value: 'AND', label: 'all conditions (AND)' },
                { value: 'OR', label: 'any condition (OR)' },
              ]}
              value={form.values.logic}
              onChange={(v) =>
                form.setFieldValue('logic', (v ?? 'AND') as 'AND' | 'OR')
              }
              allowDeselect={false}
            />
          </Group>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="xs"
              onClick={handleClear}
              type="button"
            >
              Clear
            </Button>
            <Button size="xs" type="submit">
              Apply
            </Button>
          </Group>
        </Group>

        {form.values.conditions.map((condition, index) => (
          <Group
            key={form.key(`conditions.${index}`)}
            gap="xs"
            align="flex-start"
            wrap="nowrap"
          >
            <Select
              size="xs"
              w={140}
              placeholder="Field"
              data={fields.map((f) => ({ value: f.name, label: f.label }))}
              value={condition.field || null}
              onChange={(v) => handleFieldChange(index, v ?? '')}
              allowDeselect={false}
            />
            <Select
              size="xs"
              w={140}
              placeholder="Operator"
              data={OPERATORS_BY_TYPE[getFieldType(condition.field)]}
              value={condition.op || null}
              onChange={(v) => handleOpChange(index, v ?? '')}
              allowDeselect={false}
            />
            {!NO_VALUE_OPS.has(condition.op) && (
              <ValueInput
                condition={condition}
                index={index}
                fields={fields}
                form={form}
              />
            )}
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              type="button"
              aria-label="Remove filter"
              onClick={() => form.removeListItem('conditions', index)}
              mt={2}
            >
              <IconX size={14} />
            </ActionIcon>
          </Group>
        ))}

        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={handleAddCondition}
          type="button"
          w="fit-content"
        >
          Add filter
        </Button>
      </Stack>
    </Form>
  )
}
