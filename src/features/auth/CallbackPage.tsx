import { useTranslation } from 'react-i18next'

/** Where the provider sends the browser back; AuthProvider does the work and moves on. */
export function CallbackPage() {
  const { t } = useTranslation()
  return <p role="status">{t('signIn.working')}</p>
}
