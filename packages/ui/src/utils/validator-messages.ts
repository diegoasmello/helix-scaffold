import i18n from 'i18next'

export const msg = {
  required: () => i18n.t('validation.required', { ns: 'ui' }),
  maxLength: (max: number) => i18n.t('validation.maxLength', { ns: 'ui', max }),
  minLength: (min: number) => i18n.t('validation.minLength', { ns: 'ui', min }),
  minFiles: (min: number) =>
    i18n.t('validation.minFiles', { ns: 'ui', count: min }),
  email: () => i18n.t('validation.email', { ns: 'ui' }),
}
