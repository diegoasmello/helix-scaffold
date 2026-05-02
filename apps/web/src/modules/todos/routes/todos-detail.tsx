import { useGetTodosIdSuspense } from '@helix/api-client/hooks'
import { Badge, Button, Grid, RichTextRenderer, Text } from '@helix/ui'
import { LabeledValue, PageView } from '@helix/ui'

import { todoDetailRoute } from '.'

export function TodoDetail() {
  const { id } = todoDetailRoute.useParams()
  const navigate = todoDetailRoute.useNavigate()

  const { data: item } = useGetTodosIdSuspense(id)

  return (
    <PageView
      title={item.title}
      actions={
        <Button variant="light" onClick={() => navigate({ to: '/todos' })}>
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
        <Grid.Col span={12}>
          <LabeledValue label="Content">
            <RichTextRenderer value={item.content} />
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Date">
            <Text size="md">{item.date}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Status">
            <Badge
              color={item.status === 'completed' ? 'green' : 'gray'}
              variant="light"
            >
              {item.status === 'completed' ? 'Completed' : 'Pending'}
            </Badge>
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
