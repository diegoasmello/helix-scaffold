import { Box, ThemeIcon } from '@mantine/core'
import type { IconProps } from '@tabler/icons-react'
import type { RefAttributes } from 'react'

export interface SidebarLinksGroupItemProps {
  icon: React.FC<IconProps & RefAttributes<SVGSVGElement>>
  label: string
}

export function SidebarLinksGroupItem(
  props: Readonly<SidebarLinksGroupItemProps>
) {
  const { icon: Icon, label } = props

  return (
    <Box style={{ display: 'flex', alignItems: 'center' }}>
      <ThemeIcon variant="light" size={30}>
        <Icon size={18} />
      </ThemeIcon>
      <Box ml="md">{label}</Box>
    </Box>
  )
}
