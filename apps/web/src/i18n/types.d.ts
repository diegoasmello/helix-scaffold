import type ui from '@helix/ui/locales/en'

import type audit from './locales/en/audit.json'
import type auth from './locales/en/auth.json'
import type common from './locales/en/common.json'
import type errors from './locales/en/errors.json'
import type me from './locales/en/me.json'
import type permissions from './locales/en/permissions.json'
import type roles from './locales/en/roles.json'
import type subscription from './locales/en/subscription.json'
import type todos from './locales/en/todos.json'
import type users from './locales/en/users.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      ui: typeof ui
      common: typeof common
      auth: typeof auth
      todos: typeof todos
      users: typeof users
      roles: typeof roles
      permissions: typeof permissions
      audit: typeof audit
      me: typeof me
      subscription: typeof subscription
      errors: typeof errors
    }
  }
}
