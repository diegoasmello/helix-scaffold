import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'

export type NotifyStatus = 'success' | 'warning' | 'info' | 'danger'

const statusConfig: Record<NotifyStatus, { color: string; icon: ReactNode }> = {
  success: { color: 'green', icon: <IconCheck size={18} /> },
  warning: { color: 'yellow', icon: <IconAlertTriangle size={18} /> },
  info: { color: 'blue', icon: <IconInfoCircle size={18} /> },
  danger: { color: 'red', icon: <IconAlertCircle size={18} /> },
}

export interface NotifyOptions {
  status: NotifyStatus
  message: ReactNode
  title?: string
  id?: string
  autoClose?: number | false
  withCloseButton?: boolean
  onOpen?: () => void
  onClose?: () => void
}

export function notify(options: NotifyOptions): void {
  const { status, ...rest } = options

  const { color, icon } = statusConfig[status]

  notifications.show({ color, icon, ...rest })
}
