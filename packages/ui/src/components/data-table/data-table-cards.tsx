import { css } from '@emotion/react'
import { Button, Group, Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { DataTableColumn } from 'mantine-datatable'
import type { Key, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableLayoutContext } from './data-table-layout'

export interface DataTableCardsProps<T> {
  records: readonly T[]
  columns: readonly DataTableColumn<T>[]
  idAccessor?: string | ((record: T) => Key)
  page?: number
  totalRecords?: number
  recordsPerPage?: number
  onPageChange?: (page: number) => void
  noRecordsText: string
  fetching?: boolean
}

/** Accessor of the column whose cell goes to the card's footer. */
const ACTIONS_ACCESSOR = 'actions'

/**
 * `DataTable` below the `sm` breakpoint: one card per record. The first column
 * is the card's title, the others are label/value lines, and the `actions`
 * column sits at the bottom. Pagination is reduced to previous/next.
 */
export function DataTableCards<T>(props: Readonly<DataTableCardsProps<T>>) {
  const {
    records,
    columns,
    idAccessor = 'id',
    page,
    totalRecords,
    recordsPerPage,
    onPageChange,
    noRecordsText,
    fetching,
  } = props

  const { classes } = useStyles()
  const { t } = useTranslation('ui')

  const visibleColumns = columns.filter((column) => !column.hidden)
  const actionsColumn = visibleColumns.find(
    (column) => column.accessor === ACTIONS_ACCESSOR
  )
  const [titleColumn, ...fieldColumns] = visibleColumns.filter(
    (column) => column !== actionsColumn
  )

  const totalPages =
    page && totalRecords !== undefined && recordsPerPage
      ? Math.max(1, Math.ceil(totalRecords / recordsPerPage))
      : 1

  if (records.length === 0) {
    return (
      <Text c="dimmed" ta="center" className={classes.empty}>
        {noRecordsText}
      </Text>
    )
  }

  return (
    <DataTableLayoutContext.Provider value="cards">
      <ul className={classes.list} aria-busy={fetching || undefined}>
        {records.map((record, index) => (
          <li
            key={recordKey(record, index, idAccessor)}
            className={classes.card}
          >
            {titleColumn && (
              <div className={classes.title}>
                {cellContent(titleColumn, record, index)}
              </div>
            )}
            {fieldColumns.length > 0 && (
              <dl className={classes.fields}>
                {fieldColumns.map((column) => (
                  <div key={String(column.accessor)} className={classes.field}>
                    <dt className={classes.label}>
                      {column.title ?? String(column.accessor)}
                    </dt>
                    <dd className={classes.value}>
                      {cellContent(column, record, index)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {actionsColumn && (
              <div className={classes.actions}>
                {cellContent(actionsColumn, record, index)}
              </div>
            )}
          </li>
        ))}
      </ul>

      {page && onPageChange && totalPages > 1 && (
        <Group justify="space-between" wrap="nowrap" className={classes.pager}>
          <Button
            variant="default"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {t('dataTable.previous')}
          </Button>
          <Text size="sm" c="dimmed">
            {t('dataTable.pageOf', { page, pages: totalPages })}
          </Text>
          <Button
            variant="default"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t('dataTable.next')}
          </Button>
        </Group>
      )}
    </DataTableLayoutContext.Provider>
  )
}

function cellContent<T>(
  column: DataTableColumn<T>,
  record: T,
  index: number
): ReactNode {
  if (column.render) return column.render(record, index)

  const value = valueAt(record, String(column.accessor))
  return value === null || value === undefined ? '' : String(value)
}

function recordKey<T>(
  record: T,
  index: number,
  idAccessor: string | ((record: T) => Key)
): Key {
  const key =
    typeof idAccessor === 'function'
      ? idAccessor(record)
      : valueAt(record, idAccessor)

  return typeof key === 'string' || typeof key === 'number' ? key : index
}

/** Reads a dotted accessor (`author.name`) like mantine-datatable does. */
function valueAt(record: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value !== null && typeof value === 'object'
          ? (value as Record<string, unknown>)[key]
          : undefined,
      record
    )
}

const useStyles = createStyles((theme, _, u) => ({
  list: css`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};

    &[aria-busy='true'] {
      opacity: 0.6;
    }
  `,
  card: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.md};
    border-radius: ${theme.radius.lg};
    ${u.light} {
      border: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[5]};
    }
  `,
  title: css`
    font-size: 15px;
    font-weight: 500;
    line-height: 1.4;
    overflow-wrap: anywhere;
  `,
  fields: css`
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xs};
  `,
  field: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing.md};
    min-height: 26px;
  `,
  label: css`
    font-size: 13px;
    flex-shrink: 0;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }
  `,
  value: css`
    margin: 0;
    font-size: 14px;
    text-align: right;
    min-width: 0;
    overflow-wrap: anywhere;
  `,
  actions: css`
    padding-top: ${theme.spacing.sm};
    ${u.light} {
      border-top: 1px solid ${theme.colors.gray[2]};
    }
    ${u.dark} {
      border-top: 1px solid ${theme.colors.dark[6]};
    }
  `,
  empty: css`
    padding: 48px ${theme.spacing.md};
  `,
  pager: css`
    padding-top: ${theme.spacing.md};
  `,
}))
