import type { SidebarItem } from '@helix/ui'
import {
  IconChecklist,
  IconClipboardList,
  IconCreditCard,
  IconShield,
  IconUsers,
} from '@helix/ui'

import { AUDIT_ACCESS } from '@/modules/audit/routes/access'
import {
  type AccessCheckers,
  checkPageAccess,
  type PageAccess,
} from '@/modules/auth/page-access'
import { ROLES_ACCESS } from '@/modules/roles/routes/access'
import { SUBSCRIPTIONS_ACCESS } from '@/modules/subscriptions/routes/access'
import { TODOS_ACCESS } from '@/modules/todos/routes/access'
import { USERS_ACCESS } from '@/modules/users/routes/access'

interface SidebarItemWithAccess extends SidebarItem {
  /**
   * The access the "+" shortcut (`action`) leads to — usually the module's
   * `create` access. The button shows only when the user has it.
   */
  actionAccess?: PageAccess
  /**
   * The same `PageAccess` the target route's `guardPage()` enforces — always
   * the module's constant, never a new object (`routes.test.ts` checks it).
   * Omit it only for pages every signed-in user may open.
   */
  access?: PageAccess
}

interface SidebarGroupWithAccess {
  titleKey?: string
  items: SidebarItemWithAccess[]
}

export const sidebarGroups: SidebarGroupWithAccess[] = [
  {
    items: [
      {
        label: 'nav.todos',
        icon: IconChecklist,
        to: '/todos',
        access: TODOS_ACCESS.view,
        action: { label: 'nav.createTodo', to: '/todos/create' },
        actionAccess: TODOS_ACCESS.create,
      },
    ],
  },
  {
    titleKey: 'nav.settings',
    items: [
      {
        label: 'nav.users',
        icon: IconUsers,
        to: '/users',
        access: USERS_ACCESS.view,
      },
      {
        label: 'nav.roles',
        icon: IconShield,
        to: '/roles',
        access: ROLES_ACCESS.view,
      },
      {
        label: 'nav.auditLog',
        icon: IconClipboardList,
        to: '/audit',
        access: AUDIT_ACCESS.view,
      },
      {
        label: 'nav.subscriptions',
        icon: IconCreditCard,
        to: '/subscriptions',
        access: SUBSCRIPTIONS_ACCESS.view,
      },
    ],
  },
]

/**
 * Whether the signed-in user sees the item: exactly what the target route's
 * guard would allow (`checkPageAccess`). Shared by the sidebar (`app.tsx`)
 * and the `/` redirect (`routes.ts`), so `/` always lands on a page the
 * sidebar offers — and that the route lets in.
 */
export function canSeeSidebarItem(
  item: SidebarItemWithAccess,
  checkers: AccessCheckers
): boolean {
  return item.access ? checkPageAccess(item.access, checkers).allowed : true
}

/** The first item the user can see, in sidebar order — the target of `/`. */
export function findHomeSidebarItem(
  checkers: AccessCheckers
): SidebarItemWithAccess | undefined {
  return sidebarGroups
    .flatMap((group) => group.items)
    .find((item) => canSeeSidebarItem(item, checkers))
}
