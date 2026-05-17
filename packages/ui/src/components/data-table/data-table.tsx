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
    ...rest,
  } as DataTableProps<T>

  return (
    <Paper className={classes.paper}>
      <MantineDataTable {...tableProps} className={classes.dataTable} />
    </Paper>
  )
}

const useStyles = createStyles((theme) => ({
  paper: css`
    padding: 0.75rem;
    padding-top: 0.125rem;
  `,

  dataTable: css`
    .mantine-datatable-table {
      border-collapse: separate;
      border-spacing: 0 0.75rem;
    }

    .mantine-datatable-header {
      tr {
        overflow: hidden;

        th {
          height: 3rem;
          background: ${theme.colors.gray[0]};
          border-bottom: 0;

          &:first-child {
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
              background: ${theme.colors.gray[2]};
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
        background: ${theme.colors.gray[2]};
        display: block;
        position: absolute;
        left: 0.25rem;
        right: 0.25rem;
        bottom: -0.375rem;
      }

      td:first-child {
        border-top-left-radius: ${theme.radius['md']};
        border-bottom-left-radius: ${theme.radius['md']};
      }

      td:last-child {
        border-top-right-radius: ${theme.radius['md']};
        border-bottom-right-radius: ${theme.radius['md']};
      }
    }

    .mantine-datatable-pagination {
      padding-top: 0.75rem !important;
      padding-bottom: 0.5rem !important;
      border: 0;
    }
  `,
}))
