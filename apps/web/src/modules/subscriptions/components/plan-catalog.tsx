import {
  Badge,
  Card,
  createStyles,
  css,
  Group,
  IconCheck,
  List,
  ListItem,
  SimpleGrid,
  Text,
} from '@helix/ui'
import { useTranslation } from 'react-i18next'

import type { SubscriptionPlan } from '../types'

export interface PlanCatalogProps {
  plans: SubscriptionPlan[]
  /** Highlights this plan as the user's current one. */
  currentPlanId?: string | null
}

// Plans and what each one includes. Feature keys are translated through
// `subscription:features.<key>` and fall back to the raw key.
export function PlanCatalog(props: Readonly<PlanCatalogProps>) {
  const { plans, currentPlanId } = props

  const { classes } = useStyles()
  const { t, i18n } = useTranslation('subscription')
  // Feature keys come from the API config, so they can't be typed here.
  const featureLabel = (feature: string) =>
    i18n.t(`features.${feature}`, { ns: 'subscription', defaultValue: feature })

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlanId
        return (
          <Card
            key={plan.id}
            withBorder
            padding="md"
            className={isCurrent ? classes.current : undefined}
            aria-current={isCurrent ? 'true' : undefined}
          >
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Text fw={600}>{plan.name}</Text>
              {isCurrent && (
                <Badge variant="light" size="sm">
                  {t('plans.current')}
                </Badge>
              )}
            </Group>
            {plan.features.length > 0 ? (
              <List size="sm" spacing={4} icon={<IconCheck size={14} />}>
                {plan.features.map((feature) => (
                  <ListItem key={feature}>{featureLabel(feature)}</ListItem>
                ))}
              </List>
            ) : (
              <Text size="sm" c="dimmed">
                {t('plans.noFeatures')}
              </Text>
            )}
          </Card>
        )
      })}
    </SimpleGrid>
  )
}

const useStyles = createStyles((theme) => ({
  current: css`
    border-color: ${theme.colors[theme.primaryColor][6]};
  `,
}))
