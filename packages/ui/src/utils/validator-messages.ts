type TranslationFn = (key: string, options?: Record<string, unknown>) => string

let _t: TranslationFn = (key) => key

export function configureValidatorMessages(t: TranslationFn) {
  _t = t
}

export const msg = {
  required: () => _t('validation.required'),
  maxLength: (max: number) => _t('validation.maxLength', { max }),
  minLength: (min: number) => _t('validation.minLength', { min }),
  minFiles: (min: number) => _t('validation.minFiles', { count: min }),
  email: () => _t('validation.email'),
}
