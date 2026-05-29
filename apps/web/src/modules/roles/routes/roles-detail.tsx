import { useGetRolesIdSuspense } from '@helix/api-client/hooks'
import { Button, Grid, Group, LabeledValue, PageView, Text } from '@helix/ui'
import { parseISO } from 'date-fns'

import { formatDate } from '@/utils/date'

import { rolesDetailRoute } from '.'

export function RolesDetail() {
  const { id } = rolesDetailRoute.useParams()
  const navigate = rolesDetailRoute.useNavigate()

  const { data: item } = useGetRolesIdSuspense(id)

  return (
    <PageView
      title="View Role"
      footerActions={
        <Group justify="flex-end">
          <Button
            size="md"
            variant="secondary"
            onClick={() => navigate({ to: '/roles' })}
          >
            Back
          </Button>
        </Group>
      }
    >
      <Grid>
        <Grid.Col span={12}>
          <LabeledValue label="Name">
            <Text size="md">{item.name}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={12}>
          <LabeledValue label="Description">
            <Text size="md">{item.description}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Created At">
            <Text size="md">
              {formatDate(parseISO(item.createdAt), 'short')}
            </Text>
          </LabeledValue>
        </Grid.Col>
      </Grid>
    </PageView>
  )
}
