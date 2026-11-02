import { useMatches, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import type { BreadcrumbItem } from '../../router'
import { Breadcrumb } from './breadcrumb'

/**
 * The breadcrumb of the current page, built from the deepest matched route's
 * `staticData.breadcrumbs` (labels are `common` i18n keys, translated here).
 * Renders nothing for a single crumb — it would only repeat the page title.
 */
export function RouteBreadcrumb() {
  // Pages rendered outside a router (component tests) have no route to read.
  const router = useRouter({ warn: false }) as unknown
  return router ? <MatchedBreadcrumb /> : null
}

function MatchedBreadcrumb() {
  const matches = useMatches()
  const { t: tRaw } = useTranslation('common')
  const t = tRaw as (key: string, opts?: object) => string

  const activeMatch = [...matches]
    .reverse()
    .find((m) => m.staticData.breadcrumbs?.length)

  const crumbs: BreadcrumbItem[] = activeMatch
    ? (activeMatch.staticData.breadcrumbs ?? []).map((def) => {
        const crumb =
          typeof def === 'function' ? def(activeMatch.loaderData) : def
        return {
          ...crumb,
          label: t(crumb.label, { defaultValue: crumb.label }),
        }
      })
    : []

  if (crumbs.length < 2) return null

  return <Breadcrumb crumbs={crumbs} />
}
