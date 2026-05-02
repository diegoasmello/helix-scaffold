import { useGetRolesIdSuspense } from '@helix/api-client/hooks'
import { Button, Grid, LabeledValue, PageView, Text } from '@helix/ui'

import { rolesDetailRoute } from '.'

export function RolesDetail() {
  const { id } = rolesDetailRoute.useParams()
  const navigate = rolesDetailRoute.useNavigate()

  const { data: item } = useGetRolesIdSuspense(id)

  return (
    <PageView
      title={item.name}
      actions={
        <Button variant="light" onClick={() => navigate({ to: '/roles' })}>
          Back
        </Button>
      }
    >
      <Grid>
        <Grid.Col span={12}>
          <LabeledValue label="Description">
            <Text size="md">{item.description}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Created At">
            <Text size="md">{item.createdAt}</Text>
          </LabeledValue>
        </Grid.Col>
      </Grid>
    </PageView>
  )
}
