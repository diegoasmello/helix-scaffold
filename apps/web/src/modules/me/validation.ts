import { createValidator, email, minLength, required } from '@helix/ui'

import i18n from '../../i18n'
import type {
  EmailChangeFormValues,
  MeFormValues,
  PasswordFormValues,
  SetPasswordFormValues,
} from './types'

export const meFormValidate = createValidator<MeFormValues>()({
  name: [required],
})

export function createEmailChangeFormValidate(currentEmail: string) {
  return createValidator<EmailChangeFormValues>()({
    newEmail: [
      required,
      email,
      (v) =>
        v === currentEmail
          ? i18n.t('account.email.validation.newEmailDiffers', { ns: 'me' })
          : null,
    ],
  })
}

export const passwordFormValidate = createValidator<PasswordFormValues>()({
  currentPassword: [required],
  newPassword: [minLength(8)],
  confirmPassword: (v, values) =>
    v !== values.newPassword
      ? i18n.t('security.validation.passwordsNoMatch', { ns: 'me' })
      : null,
})

export const setPasswordFormValidate = createValidator<SetPasswordFormValues>()(
  {
    newPassword: [minLength(8)],
    confirmPassword: (v, values) =>
      v !== values.newPassword
        ? i18n.t('signIn.validation.passwordsNoMatch', { ns: 'me' })
        : null,
  }
)
