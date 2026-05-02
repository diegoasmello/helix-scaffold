import { Button, Center, Group, Stack, Text, Title } from '@helix/ui'
import { useRouter } from '@tanstack/react-router'

export function NotFound() {
  const router = useRouter()

  return (
    <Center h="100vh">
      <Stack align="center" gap="md">
        <Text fz={80} fw={900} lh={1} c="dimmed">
          404
        </Text>
        <Title order={2}>Page not found</Title>
        <Text c="dimmed" ta="center" maw={400}>
          The page you are looking for does not exist or has been moved.
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
