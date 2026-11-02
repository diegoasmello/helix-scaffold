import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

export interface DetailListItem {
  label: ReactNode
  /** Empty values (`null`, `undefined`, `''`) render as "—". */
  value: ReactNode
  /** `true` leaves the line out. */
  hidden?: boolean
}

export interface DetailListProps {
  items: DetailListItem[]
}

/**
 * A record's properties as label/value lines divided by borders — the
 * "Details" block of a detail page. Semantically a `<dl>`.
 */
export function DetailList(props: Readonly<DetailListProps>) {
  const { items } = props

  const { classes } = useStyles()

  return (
    <dl className={classes.list}>
      {items
        .filter((item) => !item.hidden)
        .map((item, index) => (
          <div key={index} className={classes.row}>
            <dt className={classes.label}>{item.label}</dt>
            <dd className={classes.value}>
              {item.value === null ||
              item.value === undefined ||
              item.value === ''
                ? '—'
                : item.value}
            </dd>
          </div>
        ))}
    </dl>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  list: css`
    margin: 0;
    display: flex;
    flex-direction: column;
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing.sm};
    min-height: 48px;
    padding: 10px 0;
    ${u.light} {
      border-top: 1px solid ${theme.colors.gray[2]};
    }
    ${u.dark} {
      border-top: 1px solid ${theme.colors.dark[6]};
    }
    &:last-child {
      ${u.light} {
        border-bottom: 1px solid ${theme.colors.gray[2]};
      }
      ${u.dark} {
        border-bottom: 1px solid ${theme.colors.dark[6]};
      }
    }
  `,
  label: css`
    flex-shrink: 0;
    font-size: 14px;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }
  `,
  value: css`
    margin: 0;
    min-width: 0;
    font-size: 14px;
    font-weight: 500;
    text-align: right;
    overflow-wrap: anywhere;
  `,
}))
