import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'

import { FrontDoor } from '@/components/FrontDoor'
import { PageHeading } from '@/components/PageHeading'

import { useAuth } from './useAuth'

/** Shown in place of a page that needs a session. Signing in comes back to that page. */
export function SignInPage() {
  const { t } = useTranslation()
  const { status, signIn } = useAuth()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`
  return (
    <FrontDoor>
      <PageHeading door title={t('signIn.title')}>
        {t('signIn.body')}
      </PageHeading>
      {status === 'expired' || status === 'failed' ? (
        <p role="alert" className="mb-4 font-medium text-ochre">
          {t(status === 'expired' ? 'signIn.expired' : 'signIn.failed')}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void signIn(returnTo)}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong"
      >
        {t('signIn.button')}
      </button>
    </FrontDoor>
  )
}
