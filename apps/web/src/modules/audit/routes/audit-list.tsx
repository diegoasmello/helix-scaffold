import { useGetAuditLogsSuspense } from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import { Badge, PageList, Table } from '@helix/ui'

import { auditListRoute } from '.'

const ACTION_COLORS: Record<AuditLog['action'], string> = {
  create: 'green',
  edit: 'blue',
  delete: 'red',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

export function AuditList() {
  const { data: logs } = useGetAuditLogsSuspense()
  const navigate = auditListRoute.useNavigate()

  const rows = logs.map((log) => (
    <Table.Tr
      key={log.id}
      style={{ cursor: 'pointer' }}
      onClick={() => navigate({ to: '/audit/$id', params: { id: log.id } })}
    >
      <Table.Td>{formatDate(log.createdAt)}</Table.Td>
      <Table.Td>{log.userName}</Table.Td>
      <Table.Td>
        <Badge color={ACTION_COLORS[log.action]} variant="light">
          {log.action}
        </Badge>
      </Table.Td>
      <Table.Td>{log.resource}</Table.Td>
      <Table.Td>{log.resourceId ?? '—'}</Table.Td>
      <Table.Td>{log.ip ?? '—'}</Table.Td>
    </Table.Tr>
  ))

  return (
    <PageList title="Audit Log">
      <Table verticalSpacing="sm" withTableBorder highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>User</Table.Th>
            <Table.Th>Action</Table.Th>
            <Table.Th>Resource</Table.Th>
            <Table.Th>Resource ID</Table.Th>
            <Table.Th>IP</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </PageList>
  )
}
