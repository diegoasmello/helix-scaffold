import uiLocaleEn from '@helix/ui/locales/en'
import uiLocalePtBR from '@helix/ui/locales/pt-BR'
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import auditEn from './locales/en/audit.json'
import authEn from './locales/en/auth.json'
import commonEn from './locales/en/common.json'
import errorsEn from './locales/en/errors.json'
import meEn from './locales/en/me.json'
import rolesEn from './locales/en/roles.json'
import subscriptionEn from './locales/en/subscription.json'
import todosEn from './locales/en/todos.json'
import usersEn from './locales/en/users.json'
import auditPtBR from './locales/pt-BR/audit.json'
import authPtBR from './locales/pt-BR/auth.json'
import commonPtBR from './locales/pt-BR/common.json'
import errorsPtBR from './locales/pt-BR/errors.json'
import mePtBR from './locales/pt-BR/me.json'
import rolesPtBR from './locales/pt-BR/roles.json'
import subscriptionPtBR from './locales/pt-BR/subscription.json'
import todosPtBR from './locales/pt-BR/todos.json'
import usersPtBR from './locales/pt-BR/users.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        ui: uiLocaleEn,
        common: commonEn,
        auth: authEn,
        todos: todosEn,
        users: usersEn,
        roles: rolesEn,
        audit: auditEn,
        me: meEn,
        subscription: subscriptionEn,
        errors: errorsEn,
      },
      'pt-BR': {
        ui: uiLocalePtBR,
        common: commonPtBR,
        auth: authPtBR,
        todos: todosPtBR,
        users: usersPtBR,
        roles: rolesPtBR,
        audit: auditPtBR,
        me: mePtBR,
        subscription: subscriptionPtBR,
        errors: errorsPtBR,
      },
    },
    defaultNS: 'common',
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt-BR'],
    load: 'currentOnly',
    interpolation: { escapeValue: false },
  })

export default i18n
