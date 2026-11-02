import { css } from '@emotion/react'
import { Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { DataTableColumn } from 'mantine-datatable'
import type { Key, ReactNode } from 'react'

import { DataTableLayoutContext } from './data-table-layout'
import { DataTablePager } from './data-table-pager'

export interface DataTableCardsProps<T> {
  records: readonly T[]
  columns: readonly DataTableColumn<T>[]
  idAccessor?: string | ((record: T) => Key)
  /** Accessor of the column shown next to the title, without its label. */
  titleAside?: string
  page?: number
  totalRecords?: number
  recordsPerPage?: number
  onPageChange?: (page: number) => void
  noRecordsText: string
  /** Replaces `noRecordsText` when there are no records. */
  emptyState?: ReactNode
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
    titleAside,
    page,
    totalRecords,
    recordsPerPage,
    onPageChange,
    noRecordsText,
    emptyState,
    fetching,
  } = props

  const { classes } = useStyles()

  const visibleColumns = columns.filter((column) => !column.hidden)
  const actionsColumn = visibleColumns.find(
    (column) => column.accessor === ACTIONS_ACCESSOR
  )
  const asideColumn = titleAside
    ? visibleColumns.find((column) => column.accessor === titleAside)
    : undefined
  const [titleColumn, ...fieldColumns] = visibleColumns.filter(
    (column) => column !== actionsColumn && column !== asideColumn
  )

  const totalPages =
    page && totalRecords !== undefined && recordsPerPage
      ? Math.max(1, Math.ceil(totalRecords / recordsPerPage))
      : 1

  if (records.length === 0) {
    if (emptyState) return <>{emptyState}</>
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
              <div className={classes.titleRow}>
                <div className={classes.title}>
                  {cellContent(titleColumn, record, index)}
                </div>
                {asideColumn && (
                  <div className={classes.titleAside}>
                    {cellContent(asideColumn, record, index)}
                  </div>
                )}
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

      {page && onPageChange && totalRecords !== undefined && (
        <DataTablePager
          compact
          page={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          from={(page - 1) * (recordsPerPage ?? 0) + 1}
          to={Math.min(page * (recordsPerPage ?? 0), totalRecords)}
          onPageChange={onPageChange}
        />
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
  titleRow: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${theme.spacing.sm};
  `,
  titleAside: css`
    flex-shrink: 0;
  `,
  title: css`
    min-width: 0;
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
}))
