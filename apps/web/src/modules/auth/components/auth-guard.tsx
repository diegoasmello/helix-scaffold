import { Center, Loader } from '@helix/ui'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useAuth } from '../use-auth'

export function AuthGuard() {
  const { isAuthenticated, isPending } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      void navigate({ to: '/login' })
    }
  }, [isPending, isAuthenticated, navigate])

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <Outlet />
}
