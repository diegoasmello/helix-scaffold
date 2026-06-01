import { useBlocker } from '@tanstack/react-router'
import i18n from 'i18next'

import { asyncConfirm } from '../components'

export function useFormBlocker(
  shouldBlock: boolean = true,
  isDirty: boolean = true
) {
  useBlocker({
    shouldBlockFn: async () => {
      if (!isDirty) return false

      const shouldLeave = await asyncConfirm({
        status: 'info',
        title: i18n.t('formBlocker.title', { ns: 'ui' }),
        message: i18n.t('formBlocker.message', { ns: 'ui' }),
        color: 'main',
        confirmLabel: i18n.t('formBlocker.confirm', { ns: 'ui' }),
        cancelLabel: i18n.t('formBlocker.cancel', { ns: 'ui' }),
      })

      return !shouldLeave
    },
    enableBeforeUnload: isDirty,
    disabled: !shouldBlock,
  })
}
