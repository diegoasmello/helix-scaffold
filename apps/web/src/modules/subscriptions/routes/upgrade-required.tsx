import {
  Badge,
  Button,
  Center,
  DocumentTitle,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@helix/ui'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useSubscription } from '../hooks/use-subscription'
import { upgradeRoute } from '.'

// Shown when a route guard rejects the user's plan. Products with a checkout
// flow replace the "contact" hint with their own call to action.
export function UpgradeRequired() {
  const { feature } = upgradeRoute.useSearch()
  const navigate = upgradeRoute.useNavigate()
  const router = useRouter()
  const { t } = useTranslation('subscription')
  const { t: tc } = useTranslation('common')
  const { subscription, plan, plans, isPending } = useSubscription()

  if (isPending) {
    return (
      <Center h={120}>
        <Loader size="sm" />
      </Center>
    )
  }

  const eligiblePlans = feature
    ? plans.filter((p) => p.features.includes(feature))
    : plans

  const title = subscription
    ? t('upgrade.planLacks.title')
    : t('upgrade.noSubscription.title')

  return (
    <Center h="100%">
      <Stack align="center" gap="md" maw={480}>
        <DocumentTitle title={title} />
        <Title order={2} ta="center">
          {title}
        </Title>
        <Text c="dimmed" ta="center">
          {subscription
            ? t('upgrade.planLacks.description', {
                plan: plan?.name ?? subscription.planId,
              })
            : t('upgrade.noSubscription.description')}
        </Text>

        {eligiblePlans.length > 0 && (
          <Stack align="center" gap="xs">
            <Text size="sm" fw={500}>
              {t('upgrade.availableOn')}
            </Text>
            <Group justify="center" gap="xs">
              {eligiblePlans.map((p) => (
                <Badge key={p.id} variant="light" size="lg">
                  {p.name}
                </Badge>
              ))}
            </Group>
          </Stack>
        )}

        <Text c="dimmed" size="sm" ta="center">
          {t('upgrade.contact')}
        </Text>

        <Group mt="md">
          <Button variant="default" onClick={() => router.history.back()}>
            {tc('actions.back')}
          </Button>
          <Button onClick={() => navigate({ to: '/me/subscription' })}>
            {t('upgrade.viewSubscription')}
          </Button>
        </Group>
      </Stack>
    </Center>
  )
}
