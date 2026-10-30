import { Paper } from '@mantine/core'
import type { DataTableProps } from 'mantine-datatable'
import { DataTable as MantineDataTable } from 'mantine-datatable'
export type { DataTableColumn } from 'mantine-datatable'
export type { DataTableProps } from 'mantine-datatable'
import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'

export function DataTable<T>(
  props: Readonly<Omit<DataTableProps<T>, 'withTableBorder'>>
) {
  const {
    verticalSpacing = 'xs',
    borderRadius = 'sm',
    withColumnBorders = false,
    highlightOnHover = true,
    minHeight = 180,
    ...rest
  } = props

  const { classes } = useStyles()

  const tableProps = {
    withTableBorder: false,
    withRowBorders: false,
    verticalSpacing,
    borderRadius,
    withColumnBorders,
    highlightOnHover,
    minHeight,
    ...rest,
  } as DataTableProps<T>

  return (
    <Paper className={classes.paper}>
      <MantineDataTable {...tableProps} className={classes.dataTable} />
    </Paper>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  paper: css`
    padding: 0.75rem;
    padding-top: 0.125rem;
  `,

  dataTable: css`
    .mantine-datatable-empty-state {
      padding-top: 72px;
    }

    .mantine-datatable-table {
      border-collapse: separate;
      border-spacing: 0 0.625rem;
    }

    .mantine-datatable-header {
      tr {
        overflow: hidden;

        th {
          height: 3rem;
          border-bottom: 0;
          ${u.light} {
            background: ${theme.colors.gray[0]};
          }
          ${u.dark} {
            background: ${theme.colors.dark[6]};
          }

          &:first-of-type {
            border-top-left-radius: ${theme.radius['sm']};
            border-bottom-left-radius: ${theme.radius['sm']};
          }

          &:last-child {
            border-top-right-radius: ${theme.radius['md']};
            border-bottom-right-radius: ${theme.radius['md']};
          }

          &.mantine-datatable-header-cell-sortable {
            .mantine-datatable-text-align-center {
              padding-left: 0.875rem;
            }

            &:hover:not(:has(button:hover)) {
              ${u.light} {
                background: ${theme.colors.gray[2]};
              }
              ${u.dark} {
                background: ${theme.colors.dark[5]};
              }
            }
          }
        }
      }
    }

    .mantine-datatable-row {
      position: relative;

      &:not(:last-child):after {
        content: '';
        height: 1px;
        display: block;
        ${u.light} {
          background: ${theme.colors.gray[2]};
        }
        ${u.dark} {
          background: ${theme.colors.dark[5]};
        }
        position: absolute;
        left: 0.25rem;
        right: 0.25rem;
        bottom: -0.375rem;
      }

      td:first-of-type {
        border-top-left-radius: ${theme.radius['md']};
        border-bottom-left-radius: ${theme.radius['md']};
      }

      td:last-child {
        border-top-right-radius: ${theme.radius['md']};
        border-bottom-right-radius: ${theme.radius['md']};
      }

      td {
        padding: 0.5rem 0.75rem;
      }
    }

    .mantine-datatable-pagination {
      padding-top: 0.75rem !important;
      padding-bottom: 0.5rem !important;
      border: 0;
    }
  `,
}))
