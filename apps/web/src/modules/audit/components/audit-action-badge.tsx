import { Badge } from '@helix/ui'
import { useTranslation } from 'react-i18next'

type KnownAction = 'create' | 'edit' | 'delete' | 'export'

const ACTION_COLORS: Record<string, string> = {
  create: 'green',
  edit: 'blue',
  delete: 'red',
}

interface AuditActionBadgeProps {
  action: string
}

// The API types `action` as a plain string, so an unknown action falls back
// to its raw key and a gray badge.
export function AuditActionBadge(props: Readonly<AuditActionBadgeProps>) {
  const { action } = props

  const { t } = useTranslation('audit')

  return (
    <Badge color={ACTION_COLORS[action] ?? 'gray'} variant="light">
      {t(`actionLabels.${action as KnownAction}`, { defaultValue: action })}
    </Badge>
  )
}
