import { Button, Center, Group, Stack, Text, Title } from '@helix/ui'
import { useRouter } from '@tanstack/react-router'

export function Forbidden() {
  const router = useRouter()

  return (
    <Center h="100%">
      <Stack align="center" gap="md">
        <Text fz={80} fw={900} lh={1} c="dimmed">
          403
        </Text>
        <Title order={2}>Access denied</Title>
        <Text c="dimmed" ta="center" maw={400}>
          You do not have permission to access this page. Contact an
          administrator if you think this is a mistake.
        </Text>
        <Group mt="md">
          <Button variant="default" onClick={() => router.history.back()}>
            Go back
          </Button>
          <Button onClick={() => router.navigate({ to: '/' })}>
            Take me home
          </Button>
        </Group>
      </Stack>
    </Center>
  )
}
