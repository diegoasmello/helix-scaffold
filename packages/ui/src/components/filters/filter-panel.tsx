import { css } from '@emotion/react'
import {
  ActionIcon,
  Button,
  Menu,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { createStyles } from '@mantine/emotion'
import { IconPlus, IconX } from '@tabler/icons-react'
import { type ReactNode, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type Draft,
  type DraftCondition,
  emptyValue,
  fieldType,
  fromDraft,
  isComplete,
  newCondition,
  toDraft,
} from './draft'
import { OPERATORS, valueShape } from './operators'
import type { FilterFieldDef, LogicalFilterValue } from './types'

export interface FilterPanelProps<T extends string = string> {
  fields: FilterFieldDef<T>[]
  /** The applied filters — the panel edits a copy of them. */
  value: LogicalFilterValue
  /** Called with the complete conditions when the user applies. */
  onApply: (value: LogicalFilterValue) => void
  onCancel: () => void
  /**
   * `popover`: compact rows under the Filters button (desktop).
   * `fullscreen`: one card per condition and touch-sized inputs (phones).
   */
  layout?: 'popover' | 'fullscreen'
}

/**
 * Edits a list's filter conditions: whether all or any must match, then one
 * row per condition (field → operator → value). New conditions start from
 * the field ("Add condition" menu). Applying with an incomplete condition
 * marks it instead of dropping it silently.
 */
export function FilterPanel<T extends string = string>(
  props: Readonly<FilterPanelProps<T>>
) {
  const { fields, value, onApply, onCancel, layout = 'popover' } = props

  const { t } = useTranslation('ui')
  const { classes, cx } = useStyles()
  const [draft, setDraft] = useState<Draft>(() => toDraft(value))
  const [showErrors, setShowErrors] = useState(false)
  const matchLabelId = useId()

  const fullscreen = layout === 'fullscreen'
  // Nested dropdowns stay inside the popover, or clicking them would close it.
  const inPopover = !fullscreen
  const size = fullscreen ? 'md' : 'sm'

  const incomplete = draft.conditions.filter((c) => !isComplete(c)).length

  const update = (id: string, patch: Partial<DraftCondition>) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...patch } : condition
      ),
    }))

  const changeField = (id: string, name: string) => {
    const field = fields.find((item) => item.name === name)
    if (!field) return
    const { op, value: fresh } = newCondition(field)
    update(id, { field: name, op, value: fresh })
  }

  const changeOp = (condition: DraftCondition, op: string) => {
    const keepValue = valueShape(op) === valueShape(condition.op)
    update(condition.id, {
      op,
      value: keepValue ? condition.value : emptyValue(op),
    })
  }

  const remove = (id: string) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.filter((c) => c.id !== id),
    }))

  const add = (field: FilterFieldDef<T>) =>
    setDraft((current) => ({
      ...current,
      conditions: [...current.conditions, newCondition(field)],
    }))

  const clear = () => setDraft((current) => ({ ...current, conditions: [] }))

  const apply = () => {
    if (incomplete > 0) {
      setShowErrors(true)
      return
    }
    onApply(fromDraft(draft, fields))
  }

  const summary =
    draft.conditions.length === 0
      ? t('filters.noConditions')
      : [
          t('filters.conditionCount', { count: draft.conditions.length }),
          incomplete > 0 && t('filters.incompleteCount', { count: incomplete }),
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <section
      aria-label={t('filters.title')}
      className={cx(classes.root, fullscreen && classes.rootFullscreen)}
    >
      <div className={classes.header}>
        <div className={classes.match}>
          <span id={matchLabelId} className={classes.matchLabel}>
            {t('filters.matchLabel')}
          </span>
          <SegmentedControl
            aria-labelledby={matchLabelId}
            size={fullscreen ? 'md' : 'sm'}
            fullWidth={fullscreen}
            value={draft.logic}
            onChange={(logic) =>
              setDraft((current) => ({
                ...current,
                logic: logic as Draft['logic'],
              }))
            }
            data={[
              { value: 'AND', label: t('filters.logic.and') },
              { value: 'OR', label: t('filters.logic.or') },
            ]}
          />
        </div>
        {!fullscreen && draft.conditions.length > 0 && (
          <Button variant="subtle" color="gray" size="sm" onClick={clear}>
            {t('filters.clearAll')}
          </Button>
        )}
      </div>

      <div className={cx(classes.body, fullscreen && classes.bodyScroll)}>
        {draft.conditions.length === 0 && (
          <p className={classes.empty}>{t('filters.empty')}</p>
        )}

        {draft.conditions.map((condition, index) => {
          const type = fieldType(fields, condition.field)
          const fieldLabel =
            fields.find((f) => f.name === condition.field)?.label ?? ''
          const error =
            showErrors && !isComplete(condition)
              ? t(
                  valueShape(condition.op) === 'range'
                    ? 'filters.errors.range'
                    : 'filters.errors.required'
                )
              : undefined

          return (
            <div key={condition.id} className={classes.conditionWrap}>
              {index > 0 && (
                <span aria-hidden className={classes.connector}>
                  {draft.logic === 'AND'
                    ? t('filters.connector.and')
                    : t('filters.connector.or')}
                </span>
              )}
              <fieldset
                className={cx(
                  classes.condition,
                  fullscreen && classes.conditionCard
                )}
              >
                <legend
                  className={cx(
                    classes.legend,
                    !fullscreen && classes.visuallyHidden
                  )}
                >
                  {t('filters.conditionLegend', { index: index + 1 })}
                </legend>

                <Select
                  size={size}
                  aria-label={t('filters.field')}
                  data={fields.map((f) => ({ value: f.name, label: f.label }))}
                  value={condition.field}
                  onChange={(name) => name && changeField(condition.id, name)}
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: !inPopover }}
                />
                <Select
                  size={size}
                  aria-label={t('filters.operator')}
                  data={OPERATORS[type].map((item) => ({
                    value: item.op,
                    label: t(`filters.ops.${item.label}`),
                  }))}
                  value={condition.op}
                  onChange={(op) => op && changeOp(condition, op)}
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: !inPopover }}
                />
                <div
                  className={cx(
                    classes.value,
                    fullscreen && classes.valueFullRow
                  )}
                >
                  <ValueInput
                    condition={condition}
                    field={fields.find((f) => f.name === condition.field)}
                    size={size}
                    inPopover={inPopover}
                    error={error}
                    label={t('filters.valueOf', { index: index + 1 })}
                    onChange={(next) => update(condition.id, { value: next })}
                  />
                </div>

                {fullscreen ? (
                  <Button
                    variant="subtle"
                    color="red"
                    className={classes.removeText}
                    onClick={() => remove(condition.id)}
                  >
                    {t('filters.removeConditionShort')}
                  </Button>
                ) : (
                  <Tooltip
                    label={t('filters.removeCondition', { field: fieldLabel })}
                  >
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size={36}
                      aria-label={t('filters.removeCondition', {
                        field: fieldLabel,
                      })}
                      onClick={() => remove(condition.id)}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </fieldset>
            </div>
          )
        })}

        <Menu
          position="bottom-start"
          withinPortal={!inPopover}
          hideDetached={false}
        >
          <Menu.Target>
            <Button
              variant="default"
              size={size}
              fullWidth={fullscreen}
              className={classes.addButton}
              leftSection={<IconPlus size={16} />}
            >
              {t('filters.addCondition')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t('filters.addMenuLabel')}</Menu.Label>
            {fields.map((field) => (
              <Menu.Item key={field.name} onClick={() => add(field)}>
                {field.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </div>

      <div
        className={cx(classes.footer, fullscreen && classes.footerFullscreen)}
      >
        <span className={classes.summary} aria-live="polite">
          {summary}
        </span>
        <div className={classes.footerButtons}>
          {fullscreen ? (
            <Button variant="default" size="md" onClick={clear}>
              {t('filters.clearAll')}
            </Button>
          ) : (
            <Button variant="default" onClick={onCancel}>
              {t('filters.cancel')}
            </Button>
          )}
          <Button size={fullscreen ? 'md' : 'sm'} onClick={apply}>
            {t('filters.apply')}
          </Button>
        </div>
      </div>
    </section>
  )
}

interface ValueInputProps {
  condition: DraftCondition
  field: FilterFieldDef | undefined
  size: 'sm' | 'md'
  inPopover: boolean
  error: string | undefined
  /** Accessible name of the input ("Value of condition 2"). */
  label: string
  onChange: (value: string | string[]) => void
}

function ValueInput(props: Readonly<ValueInputProps>): ReactNode {
  const { condition, field, size, inPopover, error, label, onChange } = props

  const { t } = useTranslation('ui')
  const { classes } = useStyles()

  const shape = valueShape(condition.op)
  if (!field || shape === 'none') return null

  const comboboxProps = { withinPortal: !inPopover }
  const popoverProps = { withinPortal: !inPopover }
  const single = typeof condition.value === 'string' ? condition.value : ''
  const list = Array.isArray(condition.value) ? condition.value : []

  if (shape === 'range') {
    const [from = '', to = ''] = list
    const setBound = (index: 0 | 1, next: string) =>
      onChange(index === 0 ? [next, to] : [from, next])
    const bound = (index: 0 | 1, boundLabel: string) =>
      field.type === 'date' ? (
        <DateInput
          size={size}
          aria-label={`${label} — ${boundLabel}`}
          placeholder={boundLabel}
          value={(index === 0 ? from : to) || null}
          onChange={(date) => setBound(index, date ?? '')}
          error={Boolean(error)}
          popoverProps={popoverProps}
        />
      ) : (
        <NumberInput
          size={size}
          aria-label={`${label} — ${boundLabel}`}
          placeholder={boundLabel}
          value={index === 0 ? from : to}
          onChange={(next) => setBound(index, String(next))}
          error={Boolean(error)}
        />
      )

    return (
      <div className={classes.rangeWrap}>
        <div className={classes.range}>
          {bound(0, t('filters.from'))}
          <span className={classes.rangeJoin}>{t('filters.rangeJoin')}</span>
          {bound(1, t('filters.to'))}
        </div>
        {error && <span className={classes.error}>{error}</span>}
      </div>
    )
  }

  if (shape === 'list') {
    return (
      <MultiSelect
        size={size}
        aria-label={label}
        placeholder={list.length === 0 ? t('filters.selectPlaceholder') : ''}
        data={field.options ?? []}
        value={list}
        onChange={onChange}
        error={error}
        comboboxProps={comboboxProps}
      />
    )
  }

  switch (field.type) {
    case 'number':
      return (
        <NumberInput
          size={size}
          aria-label={label}
          placeholder={t('filters.valuePlaceholder')}
          value={single}
          onChange={(next) => onChange(String(next))}
          error={error}
        />
      )
    case 'date':
      return (
        <DateInput
          size={size}
          aria-label={label}
          placeholder={t('filters.datePlaceholder')}
          value={single || null}
          onChange={(date) => onChange(date ?? '')}
          error={error}
          popoverProps={popoverProps}
        />
      )
    case 'select':
    case 'boolean':
      return (
        <Select
          size={size}
          aria-label={label}
          placeholder={t('filters.selectPlaceholder')}
          data={
            field.type === 'boolean'
              ? [
                  { value: 'true', label: t('filters.booleanTrue') },
                  { value: 'false', label: t('filters.booleanFalse') },
                ]
              : (field.options ?? [])
          }
          value={single || null}
          onChange={(next) => onChange(next ?? '')}
          error={error}
          allowDeselect={false}
          comboboxProps={comboboxProps}
        />
      )
    default:
      return (
        <TextInput
          size={size}
          aria-label={label}
          placeholder={t('filters.valuePlaceholder')}
          value={single}
          onChange={(event) => onChange(event.currentTarget.value)}
          error={error}
        />
      )
  }
}

const useStyles = createStyles((theme, _, u) => {
  const border = (shade: 'light' | 'dark') =>
    shade === 'light' ? theme.colors.gray[3] : theme.colors.dark[5]

  return {
    root: css`
      display: flex;
      flex-direction: column;
      min-height: 0;
    `,
    rootFullscreen: css`
      height: 100%;
    `,
    header: css`
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.spacing.sm};
      padding: ${theme.spacing.md};
      ${u.light} {
        border-bottom: 1px solid ${border('light')};
      }
      ${u.dark} {
        border-bottom: 1px solid ${border('dark')};
      }
    `,
    match: css`
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.spacing.sm};
      flex: 1;
      min-width: 0;
    `,
    matchLabel: css`
      font-size: 14px;
      ${u.light} {
        color: ${theme.colors.gray[7]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[1]};
      }
    `,
    body: css`
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: ${theme.spacing.xs};
      padding: ${theme.spacing.md};

      & > .mantine-Button-root {
        align-self: flex-start;
      }
    `,
    empty: css`
      margin: 0 0 ${theme.spacing.xs};
      font-size: 14px;
      ${u.light} {
        color: ${theme.colors.gray[6]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[2]};
      }
    `,
    conditionWrap: css`
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: ${theme.spacing.xs};
    `,
    connector: css`
      margin-left: ${theme.spacing.sm};
      padding: 1px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      ${u.light} {
        border: 1px solid ${theme.colors.gray[3]};
        background-color: ${theme.colors.gray[0]};
        color: ${theme.colors.gray[7]};
      }
      ${u.dark} {
        border: 1px solid ${theme.colors.dark[5]};
        background-color: ${theme.colors.dark[6]};
        color: ${theme.colors.dark[1]};
      }
    `,
    condition: css`
      width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
      display: grid;
      grid-template-columns:
        minmax(0, 160px) minmax(0, 200px) minmax(0, 1fr)
        36px;
      gap: ${theme.spacing.xs};
      align-items: start;
    `,
    conditionCard: css`
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
      padding: 14px;
      border-radius: ${theme.radius.lg};
      ${u.light} {
        border: 1px solid ${border('light')};
      }
      ${u.dark} {
        border: 1px solid ${border('dark')};
      }
    `,
    legend: css`
      padding: 0 6px;
      font-size: 13px;
      font-weight: 500;
      ${u.light} {
        color: ${theme.colors.gray[6]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[2]};
      }
    `,
    visuallyHidden: css`
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    `,
    value: css`
      min-width: 0;
    `,
    valueFullRow: css`
      grid-column: 1 / -1;
    `,
    bodyScroll: css`
      overflow-y: auto;
    `,
    footerFullscreen: css`
      & > div {
        width: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
      }
      & .mantine-Button-root {
        height: 48px;
      }
    `,
    removeText: css`
      grid-column: 1 / -1;
      justify-self: start;
      padding-left: 4px;
      padding-right: 4px;
    `,
    rangeWrap: css`
      display: flex;
      flex-direction: column;
      gap: 4px;
    `,
    range: css`
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: ${theme.spacing.xs};
    `,
    rangeJoin: css`
      font-size: 13px;
      ${u.light} {
        color: ${theme.colors.gray[6]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[2]};
      }
    `,
    error: css`
      font-size: 13px;
      line-height: 1.4;
      color: light-dark(${theme.colors.red[7]}, ${theme.colors.red[4]});
    `,
    addButton: css`
      margin-top: ${theme.spacing.xs};
      border-style: dashed;
    `,
    footer: css`
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.spacing.sm};
      padding: ${theme.spacing.sm} ${theme.spacing.md};
      ${u.light} {
        border-top: 1px solid ${border('light')};
      }
      ${u.dark} {
        border-top: 1px solid ${border('dark')};
      }
    `,
    summary: css`
      font-size: 13.5px;
      ${u.light} {
        color: ${theme.colors.gray[7]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[1]};
      }
    `,
    footerButtons: css`
      display: flex;
      gap: 10px;
      margin-left: auto;
    `,
  }
})
