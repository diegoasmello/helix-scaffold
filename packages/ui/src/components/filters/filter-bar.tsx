import { css } from '@emotion/react'
import {
  ActionIcon,
  Button,
  Modal,
  Popover,
  useMantineTheme,
} from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconAdjustmentsHorizontal, IconX } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import { conditionSentence, describeCondition } from './describe'
import { FilterPanel } from './filter-panel'
import type { FilterFieldDef, LogicalFilterValue } from './types'

export interface FilterBarProps<T extends string = string> {
  fields: FilterFieldDef<T>[]
  /** The applied filters (usually read from the URL). */
  value: LogicalFilterValue
  /** Apply, remove one chip, or clear all — always the full new value. */
  onChange: (value: LogicalFilterValue) => void
}

/**
 * A list's filters above its table: the "Filters" button (with the number of
 * applied conditions) and each applied condition as a removable chip in
 * words ("Status is Pending"). The button opens `FilterPanel` under it, or
 * full screen below the `sm` breakpoint.
 */
export function FilterBar<T extends string = string>(
  props: Readonly<FilterBarProps<T>>
) {
  const { fields, value, onChange } = props

  const { t, i18n } = useTranslation('ui')
  const { classes, cx } = useStyles()
  const theme = useMantineTheme()
  const wide = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, true, {
    getInitialValueInEffect: false,
  })
  const [opened, { toggle, close }] = useDisclosure(false)

  const count = value.conditions.length

  const apply = (next: LogicalFilterValue) => {
    onChange(next)
    close()
  }

  const removeAt = (index: number) =>
    onChange({
      ...value,
      conditions: value.conditions.filter((_, i) => i !== index),
    })

  const panel = (layout: 'popover' | 'fullscreen') => (
    <FilterPanel
      fields={fields}
      value={value}
      onApply={apply}
      onCancel={close}
      layout={layout}
    />
  )

  const trigger = (
    <Button
      variant={count > 0 ? 'light' : 'default'}
      leftSection={<IconAdjustmentsHorizontal size={16} />}
      rightSection={
        count > 0 ? (
          <span className={classes.count} aria-hidden>
            {count}
          </span>
        ) : undefined
      }
      aria-expanded={opened}
      aria-label={
        count > 0 ? t('filters.buttonWithCount', { count }) : undefined
      }
      onClick={toggle}
    >
      {t('filters.button')}
    </Button>
  )

  return (
    <div className={classes.bar}>
      {wide ? (
        <Popover
          opened={opened}
          onChange={(next) => !next && close()}
          onDismiss={close}
          position="bottom-start"
          width="min(860px, calc(100vw - 32px))"
          trapFocus
          returnFocus
          // Stays open while the page scrolls the Filters button away.
          hideDetached={false}
          radius="lg"
          offset={8}
        >
          <Popover.Target>{trigger}</Popover.Target>
          <Popover.Dropdown p={0}>
            {opened && panel('popover')}
          </Popover.Dropdown>
        </Popover>
      ) : (
        <>
          {trigger}
          <Modal
            opened={opened}
            onClose={close}
            fullScreen
            radius={0}
            title={t('filters.title')}
            classNames={{ body: classes.modalBody, content: classes.modal }}
          >
            {opened && panel('fullscreen')}
          </Modal>
        </>
      )}

      {value.conditions.map((condition, index) => {
        const text = describeCondition(condition, fields, t, i18n.language)
        const sentence = conditionSentence(text)

        return (
          <span key={`${condition.field}-${index}`} className={classes.chip}>
            <span className={classes.chipText}>
              {text.field} {text.op}
              {text.value && (
                <>
                  {' '}
                  <strong>{text.value}</strong>
                </>
              )}
            </span>
            <ActionIcon
              variant="subtle"
              color="gray"
              radius="xl"
              size={26}
              aria-label={t('filters.removeFilter', { filter: sentence })}
              onClick={() => removeAt(index)}
            >
              <IconX size={13} />
            </ActionIcon>
          </span>
        )
      })}

      {count > 0 && (
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          className={cx(classes.clear)}
          onClick={() => onChange({ logic: 'AND', conditions: [] })}
        >
          {t('filters.clearAll')}
        </Button>
      )}
    </div>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  bar: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.spacing.xs};
  `,
  count: css`
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: ${theme.white};
    background-color: ${theme.colors[theme.primaryColor][6]};
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    min-height: 32px;
    padding: 0 3px 0 12px;
    border-radius: 999px;
    font-size: 13.5px;
    ${u.light} {
      border: 1px solid ${theme.colors.gray[3]};
      background-color: ${theme.colors.gray[0]};
      color: ${theme.colors.gray[8]};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[5]};
      background-color: ${theme.colors.dark[6]};
      color: ${theme.colors.dark[1]};
    }

    strong {
      font-weight: 600;
      ${u.light} {
        color: ${theme.colors.gray[9]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[0]};
      }
    }
  `,
  chipText: css`
    min-width: 0;
    overflow-wrap: anywhere;
  `,
  clear: css`
    font-weight: 500;
  `,
  modal: css`
    display: flex;
    flex-direction: column;
  `,
  modalBody: css`
    flex: 1;
    min-height: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  `,
}))
