import { css } from '@emotion/react'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { createStyles } from '@mantine/emotion'
import { useForm, type UseFormReturnType } from '@mantine/form'
import { IconPlus, IconX } from '@tabler/icons-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { Form } from '../form/form'
import type {
  FilterCondition,
  FilterFieldDef,
  FilterFieldType,
  LogicalFilterValue,
} from './types'

type OperatorOption = { value: string; label: string }
type OperatorsByType = Record<FilterFieldType, OperatorOption[]>

function buildOperatorsByType(t: TFunction<'ui'>): OperatorsByType {
  return {
    text: [
      { value: 'contains', label: t('filters.operators.contains') },
      { value: 'eq', label: t('filters.operators.equals') },
      { value: 'neq', label: t('filters.operators.notEquals') },
      { value: 'startsWith', label: t('filters.operators.startsWith') },
      { value: 'endsWith', label: t('filters.operators.endsWith') },
      { value: 'isNull', label: t('filters.operators.isEmpty') },
      { value: 'isNotNull', label: t('filters.operators.isNotEmpty') },
    ],
    number: [
      { value: 'eq', label: t('filters.operators.equals') },
      { value: 'neq', label: t('filters.operators.notEquals') },
      { value: 'gt', label: t('filters.operators.gt') },
      { value: 'gte', label: t('filters.operators.gte') },
      { value: 'lt', label: t('filters.operators.lt') },
      { value: 'lte', label: t('filters.operators.lte') },
      { value: 'isNull', label: t('filters.operators.isEmpty') },
      { value: 'isNotNull', label: t('filters.operators.isNotEmpty') },
    ],
    date: [
      { value: 'gte', label: t('filters.operators.onOrAfter') },
      { value: 'lte', label: t('filters.operators.onOrBefore') },
      { value: 'gt', label: t('filters.operators.after') },
      { value: 'lt', label: t('filters.operators.before') },
      { value: 'eq', label: t('filters.operators.on') },
      { value: 'isNull', label: t('filters.operators.isEmpty') },
      { value: 'isNotNull', label: t('filters.operators.isNotEmpty') },
    ],
    select: [
      { value: 'eq', label: t('filters.operators.is') },
      { value: 'neq', label: t('filters.operators.isNot') },
      { value: 'isNull', label: t('filters.operators.isEmpty') },
      { value: 'isNotNull', label: t('filters.operators.isNotEmpty') },
    ],
    boolean: [
      { value: 'eq', label: t('filters.operators.is') },
      { value: 'isNull', label: t('filters.operators.isEmpty') },
      { value: 'isNotNull', label: t('filters.operators.isNotEmpty') },
    ],
  }
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
  t: TFunction<'ui'>
}

function ValueInput(props: Readonly<ValueInputProps>) {
  const { condition, index, fields, form, t } = props
  const { classes } = useStyles()

  const fieldDef = fields.find((f) => f.name === condition.field)
  if (!fieldDef) return null

  const commonProps = { className: classes.valueInput }
  const placeholder = t('filters.valuePlaceholder')

  switch (fieldDef.type) {
    case 'text':
      return (
        <TextInput
          {...commonProps}
          placeholder={placeholder}
          {...form.getInputProps(`conditions.${index}.value`)}
        />
      )

    case 'number':
      return (
        <NumberInput
          {...commonProps}
          placeholder={placeholder}
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
          placeholder={placeholder}
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
          placeholder={placeholder}
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
          placeholder={placeholder}
          data={[
            { value: 'true', label: t('filters.booleanTrue') },
            { value: 'false', label: t('filters.booleanFalse') },
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
  const { classes } = useStyles()
  const { t } = useTranslation('ui')

  const operatorsByType = buildOperatorsByType(t)

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

  const getDefaultOp = (type: FilterFieldType) => operatorsByType[type][0].value

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
        <Group justify="space-between" align="center">
          <Group gap="xs" align="center">
            <Text size="sm" fw={500} c="dimmed">
              {t('filters.matchLabel')}
            </Text>
            <Select
              w={190}
              data={[
                { value: 'AND', label: t('filters.logic.and') },
                { value: 'OR', label: t('filters.logic.or') },
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
              color="gray"
              onClick={handleClear}
              type="button"
            >
              {t('filters.clear')}
            </Button>
            <Button type="submit">{t('filters.apply')}</Button>
          </Group>
        </Group>

        <Stack gap={5}>
          {form.values.conditions.map((condition, index) => (
            <Stack key={form.key(`conditions.${index}`)}>
              <Box className={classes.row}>
                <Group gap="xs" align="center" wrap="nowrap">
                  <Select
                    w={140}
                    placeholder={t('filters.fieldPlaceholder')}
                    data={fields.map((f) => ({
                      value: f.name,
                      label: f.label,
                    }))}
                    value={condition.field || null}
                    onChange={(v) => handleFieldChange(index, v ?? '')}
                    allowDeselect={false}
                  />
                  <Select
                    w={140}
                    placeholder={t('filters.operatorPlaceholder')}
                    data={operatorsByType[getFieldType(condition.field)]}
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
                      t={t}
                    />
                  )}
                  <ActionIcon
                    variant="subtle"
                    color="secondary"
                    size="sm"
                    type="button"
                    aria-label={t('filters.removeFilter')}
                    onClick={() => form.removeListItem('conditions', index)}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              </Box>
            </Stack>
          ))}
        </Stack>

        <UnstyledButton
          className={classes.addTrigger}
          onClick={handleAddCondition}
          type="button"
        >
          <Group gap={6}>
            <IconPlus size={14} />
            <Text size="sm">{t('filters.addFilter')}</Text>
          </Group>
        </UnstyledButton>
      </Stack>
    </Form>
  )
}

const useStyles = createStyles((theme) => ({
  row: css`
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    background-color: ${theme.colors.gray[0]};
    border: 1px solid ${theme.colors.gray[2]};
    border-radius: ${theme.radius.sm};
  `,
  connector: css`
    letter-spacing: 0.5px;
    font-size: 10px;
  `,
  valueInput: css`
    flex: 1;
    min-width: 140px;
  `,
  addTrigger: css`
    width: 100%;
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    border: 1px dashed ${theme.colors.gray[3]};
    border-radius: ${theme.radius.sm};
    color: ${theme.colors.gray[6]};
    transition:
      border-color 150ms ease,
      color 150ms ease,
      background-color 150ms ease;

    &:hover {
      border-color: ${theme.colors.gray[5]};
      color: ${theme.colors.gray[8]};
      background-color: ${theme.colors.gray[0]};
    }
  `,
}))
