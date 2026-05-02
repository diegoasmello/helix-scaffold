import { Group, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'

export type ConfirmDialogStatus = 'success' | 'warning' | 'info' | 'danger'

const statusConfig: Record<
  ConfirmDialogStatus,
  { color: string; icon: ReactNode }
> = {
  success: { color: 'green', icon: <IconCheck size={20} /> },
  warning: { color: 'yellow', icon: <IconAlertTriangle size={20} /> },
  info: { color: 'blue', icon: <IconInfoCircle size={20} /> },
  danger: { color: 'red', icon: <IconAlertCircle size={20} /> },
}

export interface ConfirmOptions {
  status: ConfirmDialogStatus
  title: string
  message?: ReactNode
  onConfirm: () => void
  onCancel?: () => void
  confirmLabel?: string
  cancelLabel?: string
  closeOnConfirm?: boolean
  closeOnCancel?: boolean
  centered?: boolean
}

export function confirm(options: ConfirmOptions): void {
  const { status, title, message, confirmLabel, cancelLabel, ...rest } = options
  const { color, icon } = statusConfig[status]

  modals.openConfirmModal({
    title: (
      <Group gap="xs">
        <Text c={color}>{icon}</Text>
        <Text fw={600}>{title}</Text>
      </Group>
    ),
    children: message,
    labels: {
      confirm: confirmLabel ?? 'Confirm',
      cancel: cancelLabel ?? 'Cancel',
    },
    confirmProps: { color },
    ...rest,
  })
}

export function asyncConfirm(
  options: Omit<ConfirmOptions, 'onConfirm' | 'onCancel '>
): Promise<boolean> {
  const { status, title, message, confirmLabel, cancelLabel, ...rest } = options
  const { color, icon } = statusConfig[status]

  return new Promise((resolve) => {
    modals.openConfirmModal({
      title: (
        <Group gap="xs">
          <Text c={color}>{icon}</Text>
          <Text fw={600}>{title}</Text>
        </Group>
      ),
      children: message,
      labels: {
        confirm: confirmLabel ?? 'Confirm',
        cancel: cancelLabel ?? 'Cancel',
      },
      confirmProps: { color },
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      ...rest,
    })
  })
}
