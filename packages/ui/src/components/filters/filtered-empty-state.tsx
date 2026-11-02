import { css } from '@emotion/react'
import { Button } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconAdjustmentsHorizontal } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface FilteredEmptyStateProps {
  /** e.g. "No todos found". */
  title: ReactNode
  /** What narrowed the list — e.g. the search term and the filters. */
  description?: ReactNode
  /** Opens the filter panel. */
  onEditFilters?: () => void
  /** Drops the search and the filters. */
  onClear: () => void
}

/**
 * A list with no results because of its search or filters (pass it as the
 * `DataTable`'s `emptyState`): says why and offers the way back, unlike
 * `EmptyState`, which is for a list with nothing in it yet.
 */
export function FilteredEmptyState(props: Readonly<FilteredEmptyStateProps>) {
  const { title, description, onEditFilters, onClear } = props

  const { t } = useTranslation('ui')
  const { classes } = useStyles()

  return (
    <div className={classes.root}>
      <span aria-hidden className={classes.icon}>
        <IconAdjustmentsHorizontal size={22} stroke={1.7} />
      </span>
      <div className={classes.text}>
        <h2 className={classes.title}>{title}</h2>
        {description && <p className={classes.description}>{description}</p>}
      </div>
      <div className={classes.actions}>
        {onEditFilters && (
          <Button variant="default" onClick={onEditFilters}>
            {t('filters.editFilters')}
          </Button>
        )}
        <Button variant="default" onClick={onClear}>
          {t('filters.clearSearchAndFilters')}
        </Button>
      </div>
    </div>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  root: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 48px ${theme.spacing.lg} 56px;
    text-align: center;
  `,
  icon: css`
    width: 48px;
    height: 48px;
    border-radius: ${theme.radius.lg};
    display: flex;
    align-items: center;
    justify-content: center;
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
  text: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 460px;
  `,
  title: css`
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    ${u.light} {
      color: ${theme.colors.gray[9]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[0]};
    }
  `,
  description: css`
    margin: 0;
    font-size: 14.5px;
    line-height: 1.55;
    ${u.light} {
      color: ${theme.colors.gray[7]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[1]};
    }
  `,
  actions: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: ${theme.spacing.xs};
  `,
}))
