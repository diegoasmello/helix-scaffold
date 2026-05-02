import { useGetAuditLogsIdSuspense } from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import { Badge, Button, Grid, LabeledValue, PageView, Text } from '@helix/ui'

import { auditDetailRoute } from '.'

const ACTION_COLORS: Record<AuditLog['action'], string> = {
  create: 'green',
  edit: 'blue',
  delete: 'red',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

export function AuditDetail() {
  const { id } = auditDetailRoute.useParams()
  const navigate = auditDetailRoute.useNavigate()

  const { data: log } = useGetAuditLogsIdSuspense(id)

  return (
    <PageView
      title={`${log.resource} — ${log.action}`}
      actions={
        <Button variant="light" onClick={() => navigate({ to: '/audit' })}>
          Back
        </Button>
      }
    >
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Date">
            <Text size="md">{formatDate(log.createdAt)}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Action">
            <Badge color={ACTION_COLORS[log.action]} variant="light">
              {log.action}
            </Badge>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="User">
            <Text size="md">{log.userName}</Text>
            <Text size="sm" c="dimmed">
              {log.userEmail}
            </Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Resource">
            <Text size="md">{log.resource}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Resource ID">
            <Text size="md">{log.resourceId ?? '—'}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="IP">
            <Text size="md">{log.ip ?? '—'}</Text>
          </LabeledValue>
        </Grid.Col>
        {log.userAgent && (
          <Grid.Col span={12}>
            <LabeledValue label="User Agent">
              <Text size="md">{log.userAgent}</Text>
            </LabeledValue>
          </Grid.Col>
        )}
        {log.metadata != null && (
          <Grid.Col span={12}>
            <LabeledValue label="Metadata">
              <Text
                size="md"
                component="pre"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
              >
                {JSON.stringify(log.metadata, null, 2)}
              </Text>
            </LabeledValue>
          </Grid.Col>
        )}
      </Grid>
    </PageView>
  )
}
