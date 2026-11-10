import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { en } from './en'

export const defaultNS = 'translation'
export const resources = { en: { [defaultNS]: en } } as const

/**
 * English first. A new language is one more file with the keys of `en`, added to
 * `resources`. React escapes what it renders, so i18next's own escaping is off.
 */
void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  interpolation: { escapeValue: false },
})

export default i18n
