import { z } from 'zod'

import appConfig from '@/app.config'
import { env } from '@/env'

import {
  type AppConfig,
  appConfigSchema,
  type ResolvedAppConfig,
} from './define-config'
import { isSpecExport, specConfigOverrides } from './spec-overrides'
import { testConfigOverrides } from './test-overrides'

type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, overrides: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return (overrides ?? base) as T
  }
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = deepMerge(base[key], value)
  }
  return result as T
}

function deepFreeze<T>(value: T): T {
  if (isPlainObject(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const SOCIAL_PROVIDER_CREDENTIALS = {
  google: [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET],
  facebook: [env.FACEBOOK_CLIENT_ID, env.FACEBOOK_CLIENT_SECRET],
  apple: [env.APPLE_CLIENT_ID, env.APPLE_CLIENT_SECRET],
} as const

function validateAgainstEnv(resolved: ResolvedAppConfig) {
  const errors: string[] = []

  for (const [name, [clientId, clientSecret]] of Object.entries(
    SOCIAL_PROVIDER_CREDENTIALS
  )) {
    const provider =
      resolved.auth.socialProviders[
        name as keyof typeof SOCIAL_PROVIDER_CREDENTIALS
      ]
    if (provider.enabled && (!clientId || !clientSecret)) {
      const prefix = name.toUpperCase()
      errors.push(
        `auth.socialProviders.${name} is enabled, but ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET are not set in .env`
      )
    }
  }

  const { plans, trial, enabled } = resolved.subscriptions
  const planIds = plans.map((plan) => plan.id)
  const duplicates = planIds.filter((id, i) => planIds.indexOf(id) !== i)
  if (duplicates.length > 0) {
    errors.push(
      `subscriptions.plans has duplicate ids: ${[...new Set(duplicates)].join(', ')}`
    )
  }
  if (enabled && plans.length === 0) {
    errors.push(
      'subscriptions.enabled is true, but subscriptions.plans is empty — declare at least one plan'
    )
  }
  if (enabled && trial && !planIds.includes(trial.planId)) {
    errors.push(
      `subscriptions.trial.planId '${trial.planId}' is not one of subscriptions.plans (${planIds.join(', ')})`
    )
  }

  if (errors.length > 0) {
    throw new Error(`Invalid src/app.config.ts:\n  ✖ ${errors.join('\n  ✖ ')}`)
  }

  if (trial && (!enabled || resolved.registration.mode !== 'open')) {
    console.warn(
      "[config] subscriptions.trial has no effect: it requires subscriptions.enabled = true and registration.mode = 'open'"
    )
  }
}

function resolveConfig(): DeepReadonly<ResolvedAppConfig> {
  const mode = env.NODE_ENV
  const raw: AppConfig =
    typeof appConfig === 'function' ? appConfig({ mode }) : appConfig
  const overrides = isSpecExport()
    ? specConfigOverrides
    : mode === 'test'
      ? testConfigOverrides
      : undefined
  const merged = overrides ? deepMerge(raw, overrides) : raw

  const parsed = appConfigSchema.safeParse(merged)
  if (!parsed.success) {
    throw new Error(
      `Invalid src/app.config.ts:\n${z.prettifyError(parsed.error)}`
    )
  }

  validateAgainstEnv(parsed.data)
  return deepFreeze(parsed.data)
}

export const config = resolveConfig()

export type { AppConfig, ResolvedAppConfig } from './define-config'
