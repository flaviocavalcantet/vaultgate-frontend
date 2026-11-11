import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { SignInPage } from './SignInPage'
import { useAuth } from './useAuth'

/**
 * The routes inside need a session. This decides what the page shows, nothing more: the
 * API checks the token and the access policies on every request, whatever the page shows.
 */
export function RequireAuth() {
  const { t } = useTranslation()
  const { status } = useAuth()
  if (status === 'loading') {
    return <p role="status">{t('signIn.working')}</p>
  }
  return status === 'signedIn' ? <Outlet /> : <SignInPage />
}
