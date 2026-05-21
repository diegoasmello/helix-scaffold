import { useBlocker } from '@tanstack/react-router'

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
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        color: 'main',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
      })

      return !shouldLeave
    },
    enableBeforeUnload: isDirty,
    disabled: !shouldBlock,
  })
}
