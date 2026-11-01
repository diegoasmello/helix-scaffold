import type { PageAccess } from '@/modules/auth/page-access'

/** Every todos page also needs the `todos` plan feature — same gate as the API's `requireSubscription('todos')`. */
export const TODOS_ACCESS = {
  view: { permission: { resource: 'todos', action: 'view' }, feature: 'todos' },
  create: {
    permission: { resource: 'todos', action: 'create' },
    feature: 'todos',
  },
  edit: { permission: { resource: 'todos', action: 'edit' }, feature: 'todos' },
} satisfies Record<string, PageAccess>
