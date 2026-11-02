import { css } from '@emotion/react'
import {
  ActionIcon,
  Button,
  Popover,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconBell } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface NotificationItem {
  id: string
  /** The message — may hold `<b>` for the names it mentions. */
  message: ReactNode
  /** Already formatted for display ("5 minutes ago"). */
  time: string
  unread: boolean
  /** A 34px circle on the left: an icon or initials. */
  icon?: ReactNode
}

export interface NotificationsMenuProps {
  items: NotificationItem[]
  onItemClick?: (item: NotificationItem) => void
  onMarkAllRead?: () => void
  onViewAll?: () => void
}

/**
 * The header's bell: a count of unread items and a panel listing them.
 * Pure UI — the app supplies the items and decides what each action does.
 */
export function NotificationsMenu(props: Readonly<NotificationsMenuProps>) {
  const { items, onItemClick, onMarkAllRead, onViewAll } = props

  const { t } = useTranslation('ui')
  const { classes, cx } = useStyles()
  const unread = items.filter((item) => item.unread).length

  return (
    <Popover position="bottom-end" width={392} radius="lg" withinPortal>
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={42}
          radius="xl"
          className={classes.bell}
          aria-label={
            unread > 0
              ? t('notifications.openWithUnread', { count: unread })
              : t('notifications.open')
          }
        >
          <IconBell size={20} stroke={1.7} />
          {unread > 0 && (
            <span aria-hidden className={classes.count}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <section aria-label={t('notifications.title')}>
          <div className={classes.head}>
            <Text fw={600} size="md">
              {t('notifications.title')}
            </Text>
            {onMarkAllRead && unread > 0 && (
              <Button variant="subtle" size="xs" onClick={onMarkAllRead}>
                {t('notifications.markAllRead')}
              </Button>
            )}
          </div>
          {items.length === 0 ? (
            <Text size="sm" c="dimmed" className={classes.empty}>
              {t('notifications.empty')}
            </Text>
          ) : (
            <ul className={classes.list}>
              {items.map((item) => (
                <li key={item.id}>
                  <UnstyledButton
                    className={cx(classes.item, {
                      [classes.itemUnread]: item.unread,
                    })}
                    onClick={() => onItemClick?.(item)}
                  >
                    {item.icon && (
                      <span className={classes.icon}>{item.icon}</span>
                    )}
                    <span className={classes.body}>
                      <span className={classes.message}>{item.message}</span>
                      <span className={classes.time}>{item.time}</span>
                    </span>
                    {item.unread && (
                      <span
                        className={classes.unreadDot}
                        aria-label={t('notifications.unread')}
                      />
                    )}
                  </UnstyledButton>
                </li>
              ))}
            </ul>
          )}
          {onViewAll && (
            <UnstyledButton className={classes.footer} onClick={onViewAll}>
              {t('notifications.viewAll')}
            </UnstyledButton>
          )}
        </section>
      </Popover.Dropdown>
    </Popover>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  bell: css`
    position: relative;
    ${u.light} {
      color: ${theme.colors.gray[8]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[1]};
    }
  `,
  count: css`
    position: absolute;
    top: 5px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    box-sizing: border-box;
    border-radius: 999px;
    background-color: ${theme.colors.red[7]};
    color: ${theme.white};
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    ${u.light} {
      box-shadow: 0 0 0 2px ${theme.white};
    }
    ${u.dark} {
      box-shadow: 0 0 0 2px ${theme.colors.dark[7]};
    }
  `,
  head: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing.sm};
    padding: 14px ${theme.spacing.md} 10px 18px;
  `,
  empty: css`
    padding: ${theme.spacing.md} 18px ${theme.spacing.lg};
  `,
  list: css`
    list-style: none;
    margin: 0;
    padding: 0 ${theme.spacing.xs} ${theme.spacing.xs};
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 420px;
    overflow-y: auto;
  `,
  item: css`
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.sm} 10px;
    border-radius: ${theme.radius.lg};
    text-align: left;

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[1]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
      }
    }
  `,
  itemUnread: css`
    ${u.light} {
      background-color: ${theme.colors.main[0]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[6]};
    }
  `,
  icon: css`
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  `,
  body: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  `,
  message: css`
    font-size: ${theme.fontSizes.sm};
    line-height: 1.45;
  `,
  time: css`
    font-size: 12.5px;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }
  `,
  unreadDot: css`
    width: 8px;
    height: 8px;
    margin-top: 6px;
    flex-shrink: 0;
    border-radius: 999px;
    background-color: ${theme.colors.main[6]};
  `,
  footer: css`
    display: block;
    width: 100%;
    padding: 13px ${theme.spacing.md};
    text-align: center;
    font-size: ${theme.fontSizes.sm};
    font-weight: 500;
    ${u.light} {
      border-top: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border-top: 1px solid ${theme.colors.dark[5]};
    }

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[0]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[6]};
      }
    }
  `,
}))
