import { Box, Group, Title } from '@mantine/core'
import { modals } from '@mantine/modals'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
} from '@tabler/icons-react'
import i18n from 'i18next'
import type { ReactNode } from 'react'

export type ConfirmDialogStatus = 'success' | 'warning' | 'info' | 'danger'

const STATUS_CONFIG: Record<
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
  color?: 'main' | ConfirmDialogStatus
  closeOnConfirm?: boolean
  closeOnCancel?: boolean
  centered?: boolean
}

type SharedOptions = Omit<ConfirmOptions, 'onConfirm' | 'onCancel'>

function buildModalProps(options: SharedOptions) {
  const { status, title, message, confirmLabel, cancelLabel, color, ...rest } =
    options

  const { color: statusColor, icon } = STATUS_CONFIG[status]

  const computedColor = color ?? statusColor

  return {
    title: (
      <Group gap="xs">
        <Box h={20} c={computedColor}>
          {icon}
        </Box>
        <Title order={5} fw={700} lh={1}>
          {title}
        </Title>
      </Group>
    ),
    children: message,
    centered: true,
    labels: {
      // i18n singleton is safe here: apps/web imports './i18n' before createRoot,
      // so the 'ui' namespace is registered before any modal can open.
      confirm: confirmLabel ?? i18n.t('confirm.confirm', { ns: 'ui' }),
      cancel: cancelLabel ?? i18n.t('confirm.cancel', { ns: 'ui' }),
    },
    confirmProps: { color: computedColor },
    groupProps: { gap: 'xs' },
    ...rest,
  }
}

export function confirm(options: ConfirmOptions): void {
  const { onConfirm, onCancel, ...shared } = options

  modals.openConfirmModal({ ...buildModalProps(shared), onConfirm, onCancel })
}

export function asyncConfirm(
  options: Omit<ConfirmOptions, 'onConfirm' | 'onCancel'>
): Promise<boolean> {
  return new Promise((resolve) => {
    modals.openConfirmModal({
      ...buildModalProps(options),
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}
