import type { UseFormReturnType } from '@helix/ui'
import { DateInput, Grid, GridCol, Select, TextInput } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import type { SubscriptionFormValues } from '../types'

interface SubscriptionsFormProps {
  form: UseFormReturnType<SubscriptionFormValues>
  isEditing?: boolean
}

const STATUS_OPTIONS = [
  'active',
  'trialing',
  'canceled',
  'past_due',
  'expired',
] as const

export function SubscriptionsForm(props: Readonly<SubscriptionsFormProps>) {
  const { form, isEditing = false } = props
  const { t } = useTranslation('subscription')

  return (
    <Grid>
      {!isEditing && (
        <GridCol span={12}>
          <TextInput
            label={t('form.userId.label')}
            placeholder={t('form.userId.placeholder')}
            required
            {...form.getInputProps('userId')}
          />
        </GridCol>
      )}

      <GridCol span={{ base: 12, sm: 6 }}>
        <TextInput
          label={t('form.planId.label')}
          placeholder={t('form.planId.placeholder')}
          required
          {...form.getInputProps('planId')}
        />
      </GridCol>

      <GridCol span={{ base: 12, sm: 6 }}>
        <Select
          label={t('form.status.label')}
          required
          data={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: t(`status.${s}`),
          }))}
          value={form.values.status}
          onChange={(value) =>
            form.setFieldValue(
              'status',
              (value ?? 'active') as SubscriptionFormValues['status']
            )
          }
          error={form.errors.status}
        />
      </GridCol>

      <GridCol span={{ base: 12, sm: 6 }}>
        <DateInput
          label={t('form.currentPeriodStart.label')}
          required
          value={
            form.values.currentPeriodStart
              ? new Date(form.values.currentPeriodStart)
              : null
          }
          onChange={(date) =>
            form.setFieldValue(
              'currentPeriodStart',
              date ? new Date(date).toISOString() : ''
            )
          }
          error={form.errors.currentPeriodStart}
        />
      </GridCol>

      <GridCol span={{ base: 12, sm: 6 }}>
        <DateInput
          label={t('form.currentPeriodEnd.label')}
          required
          value={
            form.values.currentPeriodEnd
              ? new Date(form.values.currentPeriodEnd)
              : null
          }
          onChange={(date) =>
            form.setFieldValue(
              'currentPeriodEnd',
              date ? new Date(date).toISOString() : ''
            )
          }
          error={form.errors.currentPeriodEnd}
        />
      </GridCol>

      <GridCol span={{ base: 12, sm: 6 }}>
        <DateInput
          label={t('form.trialEndsAt.label')}
          value={
            form.values.trialEndsAt ? new Date(form.values.trialEndsAt) : null
          }
          onChange={(date) =>
            form.setFieldValue(
              'trialEndsAt',
              date ? new Date(date).toISOString() : null
            )
          }
          error={form.errors.trialEndsAt}
          clearable
        />
      </GridCol>

      <GridCol span={{ base: 12, sm: 6 }}>
        <TextInput
          label={t('form.externalId.label')}
          placeholder={t('form.externalId.placeholder')}
          {...form.getInputProps('externalId')}
        />
      </GridCol>
    </Grid>
  )
}
