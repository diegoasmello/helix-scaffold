import { useGetUsersIdSuspense } from '@helix/api-client/hooks'
import { Button, Grid, Group, LabeledValue, PageView, Text } from '@helix/ui'
import { parseISO } from 'date-fns'

import { formatDate } from '@/utils/date'

import { usersDetailRoute } from '.'

export function UsersDetail() {
  const { id } = usersDetailRoute.useParams()
  const navigate = usersDetailRoute.useNavigate()

  const { data: item } = useGetUsersIdSuspense(id)

  return (
    <PageView
      title="View User"
      footerActions={
        <Group justify="flex-end">
          <Button
            size="md"
            variant="secondary"
            onClick={() => navigate({ to: '/users' })}
          >
            Back
          </Button>
        </Group>
      }
    >
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Name">
            <Text size="md">{item.name}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Email">
            <Text size="md">{item.email}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Role">
            <Text size="md">{item.role?.name ?? '—'}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Email Verified">
            <Text size="md">{item.emailVerified ? 'Yes' : 'No'}</Text>
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
