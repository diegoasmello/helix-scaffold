import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import type { IconProps } from '@tabler/icons-react'
import type { RefAttributes } from 'react'

export interface SidebarLinksGroupItemProps {
  icon: React.FC<IconProps & RefAttributes<SVGSVGElement>>
  label: string
  active?: boolean
}

export function SidebarLinksGroupItem(
  props: Readonly<SidebarLinksGroupItemProps>
) {
  const { icon: Icon, label, active } = props

  const { classes, cx } = useStyles()

  return (
    <div className={classes.item}>
      <Icon
        size={18}
        stroke={1.5}
        className={cx(classes.icon, { [classes.iconActive]: active })}
      />
      <span className={cx(classes.label, { [classes.labelActive]: active })}>
        {label}
      </span>
    </div>
  )
}

const useStyles = createStyles((theme) => ({
  item: css`
    display: flex;
    align-items: center;
    gap: 14px;
  `,
  icon: css`
    color: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.4));
    flex-shrink: 0;
  `,
  iconActive: css`
    color: ${theme.colors.main[6]};
  `,
  label: css`
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.154px;
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.75));
    line-height: normal;
  `,
  labelActive: css`
    font-weight: 600;
    color: ${theme.colors.main[6]};
  `,
}))
