import { Button, Center, Code, Group, Stack, Text, Title } from '@helix/ui'
import { useRouter } from '@tanstack/react-router'

interface ErrorBoundaryProps {
  error: Error
  reset: () => void
}

export function ErrorBoundary(props: Readonly<ErrorBoundaryProps>) {
  const { error, reset } = props

  const router = useRouter()

  return (
    <Center h="100vh">
      <Stack align="center" gap="md" maw={500}>
        <Text fz={80} fw={900} lh={1} c="dimmed">
          500
        </Text>
        <Title order={2}>Something went wrong</Title>
        <Text c="dimmed" ta="center">
          An unexpected error occurred. Try refreshing the page or going back.
        </Text>
        {error.message && (
          <Code block w="100%" style={{ wordBreak: 'break-word' }}>
            {error.message}
          </Code>
        )}
        <Group mt="md">
          <Button variant="default" onClick={() => router.history.back()}>
            Go back
          </Button>
          <Button onClick={reset}>Try again</Button>
        </Group>
      </Stack>
    </Center>
  )
}
