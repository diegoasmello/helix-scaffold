import { Divider, Stack } from '@helix/ui'

import { PasswordSection } from '../components/password-section'
import { SignInMethods } from '../components/sign-in-methods'

export function MeSecurity() {
  return (
    <Stack gap="xl">
      <PasswordSection />
      <Divider />
      <SignInMethods />
    </Stack>
  )
}
