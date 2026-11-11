import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'

import { PageHeading } from '@/components/PageHeading'

import { useAuth } from './useAuth'

/** Shown in place of a page that needs a session. Signing in comes back to that page. */
export function SignInPage() {
  const { t } = useTranslation()
  const { status, signIn } = useAuth()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`
  return (
    <>
      <PageHeading title={t('signIn.title')}>{t('signIn.body')}</PageHeading>
      {status === 'expired' || status === 'failed' ? (
        <p role="alert" className="mb-4 font-medium text-amber-800 dark:text-amber-300">
          {t(status === 'expired' ? 'signIn.expired' : 'signIn.failed')}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void signIn(returnTo)}
        className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
      >
        {t('signIn.button')}
      </button>
    </>
  )
}
