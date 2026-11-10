import 'i18next'

import type { defaultNS, resources } from './i18n'

// Translation keys are checked by the compiler: t('nav.hme') does not build.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['en']
  }
}
