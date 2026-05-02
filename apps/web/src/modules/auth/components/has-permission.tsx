import type { PermissionAction } from '@helix/api-client/types'
import type { ReactNode } from 'react'

import { useAuth } from '../use-auth'

interface HasPermissionProps {
  resource: string
  action: PermissionAction
  children: ReactNode
}

export function HasPermission(props: Readonly<HasPermissionProps>) {
  const { resource, action, children } = props
  const { hasPermission } = useAuth()
  return hasPermission(resource, action) ? <>{children}</> : null
}
