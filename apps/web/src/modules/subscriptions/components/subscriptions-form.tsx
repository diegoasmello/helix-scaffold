import type { UseFormReturnType } from '@helix/ui'
import {
  DateInput,
  FormSection,
  Select,
  SimpleGrid,
  TextInput,
} from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { UserSelectField } from '../../users/components/user-select-field'
import type { SubscriptionFormValues, SubscriptionPlan } from '../types'

export interface SubscriptionsFormProps {
  form: UseFormReturnType<SubscriptionFormValues>
  plans: SubscriptionPlan[]
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
  const { form, plans, isEditing = false } = props

  const { t } = useTranslation('subscription')

  const planOptions = plans.map((plan) => ({
    value: plan.id,
    label: plan.name,
  }))
  // Keep a plan that was removed from the catalog selectable on edit.
  const currentPlanId = form.values.planId
  if (currentPlanId && !plans.some((plan) => plan.id === currentPlanId)) {
    planOptions.push({ value: currentPlanId, label: currentPlanId })
  }

  return (
    <>
      <FormSection
        title={t('sections.plan')}
        description={t('sections.planDescription')}
      >
        {!isEditing && (
          <UserSelectField required {...form.getInputProps('userId')} />
        )}
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <Select
            label={t('form.planId.label')}
            placeholder={t('form.planId.placeholder')}
            required
            data={planOptions}
            allowDeselect={false}
            {...form.getInputProps('planId')}
          />
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
        </SimpleGrid>
      </FormSection>

      <FormSection
        title={t('sections.period')}
        description={t('sections.periodDescription')}
      >
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <DateInput
            label={t('form.currentPeriodStart.label')}
            required
            {...form.getInputProps('currentPeriodStart')}
          />
          <DateInput
            label={t('form.currentPeriodEnd.label')}
            required
            {...form.getInputProps('currentPeriodEnd')}
          />
          <DateInput
            label={t('form.trialEndsAt.label')}
            clearable
            {...form.getInputProps('trialEndsAt')}
          />
        </SimpleGrid>
      </FormSection>

      <FormSection
        title={t('sections.billing')}
        description={t('sections.billingDescription')}
      >
        <TextInput
          label={t('form.externalId.label')}
          placeholder={t('form.externalId.placeholder')}
          {...form.getInputProps('externalId')}
        />
      </FormSection>
    </>
  )
}
