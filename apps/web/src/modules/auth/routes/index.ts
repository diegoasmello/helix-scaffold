import { getBootstrapStatus } from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { queryClient } from '@/lib/query-client'
import { rootRoute } from '@/routes'

import { registrationStatusQueryOptions } from '../use-registration-open'
import { Bootstrap } from './bootstrap'
import { ForgotPassword } from './forgot-password'
import { Login } from './login'
import { ResetPassword } from './reset-password'
import { SignUp } from './sign-up'

export const bootstrapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bootstrap',
  component: Bootstrap,
  loader: async () => {
    const { bootstrapped } = await getBootstrapStatus()
    if (bootstrapped) throw redirect({ to: '/login' })
  },
})

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
  // better-auth sends a failed social sign-in back here (`errorCallbackURL`)
  validateSearch: z.object({ error: z.string().optional() }),
  loader: async () => {
    const [{ bootstrapped }, { open, providers, email }] = await Promise.all([
      getBootstrapStatus(),
      // Cached for the session, like every reader of the status
      queryClient.ensureQueryData(registrationStatusQueryOptions()),
    ])
    if (!bootstrapped) throw redirect({ to: '/bootstrap' })
    return { registrationOpen: open, providers, emailEnabled: email }
  },
})

export const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up',
  component: SignUp,
  loader: async () => {
    const [{ bootstrapped }, { open, providers }] = await Promise.all([
      getBootstrapStatus(),
      queryClient.ensureQueryData(registrationStatusQueryOptions()),
    ])
    if (!bootstrapped) throw redirect({ to: '/bootstrap' })
    if (!open) throw redirect({ to: '/login' })
    return { providers }
  },
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPassword,
  loader: async () => {
    const [{ bootstrapped }, { email }] = await Promise.all([
      getBootstrapStatus(),
      queryClient.ensureQueryData(registrationStatusQueryOptions()),
    ])
    if (!bootstrapped) throw redirect({ to: '/bootstrap' })
    // Without email there is no reset: the login's link opens
    // ContactAdminModal instead, and a typed URL lands there too.
    if (!email) throw redirect({ to: '/login' })
  },
})

export const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPassword,
  validateSearch: z.object({
    token: z.string().optional(),
    error: z.string().optional(),
  }),
})

export const authRoutes = [
  bootstrapRoute,
  loginRoute,
  signUpRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
]
