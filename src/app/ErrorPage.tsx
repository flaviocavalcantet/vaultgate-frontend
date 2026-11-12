import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router'

import { PageHeading } from '@/components/PageHeading'

/**
 * Shown when a route fails to render or load. The error goes to the console for whoever
 * debugs it; the page never shows its text, which may carry internals.
 */
export function ErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className="mx-auto max-w-5xl px-4 py-8" role="alert">
      <PageHeading title={t('error.title')}>{t('error.body')}</PageHeading>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong"
      >
        {t('error.reload')}
      </button>
    </main>
  )
}
