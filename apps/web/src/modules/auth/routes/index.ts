import {
  getBootstrapStatus,
  getRegistrationStatus,
} from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'

import { rootRoute } from '@/routes'

import { Bootstrap } from './bootstrap'
import { Login } from './login'
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
  loader: async () => {
    const [{ bootstrapped }, { open, providers }] = await Promise.all([
      getBootstrapStatus(),
      getRegistrationStatus(),
    ])
    if (!bootstrapped) throw redirect({ to: '/bootstrap' })
    return { registrationOpen: open, providers }
  },
})

export const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up',
  component: SignUp,
  loader: async () => {
    const [{ bootstrapped }, { open, providers }] = await Promise.all([
      getBootstrapStatus(),
      getRegistrationStatus(),
    ])
    if (!bootstrapped) throw redirect({ to: '/bootstrap' })
    if (!open) throw redirect({ to: '/login' })
    return { providers }
  },
})

export const authRoutes = [bootstrapRoute, loginRoute, signUpRoute]
