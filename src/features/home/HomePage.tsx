import { useTranslation } from 'react-i18next'

import { PageHeading } from '@/components/PageHeading'
import { useMe } from '@/features/auth/useMe'

export function HomePage() {
  const { t } = useTranslation()
  const me = useMe()
  return (
    <>
      <PageHeading title={t('home.title')}>{t('home.body')}</PageHeading>
      <section aria-labelledby="account">
        <h2 id="account" className="mb-3 text-lg font-semibold">
          {t('home.account')}
        </h2>
        {me.isPending ? <p role="status">{t('home.loading')}</p> : null}
        {me.isError ? (
          <div role="alert">
            <p className="mb-3">{t('home.failed')}</p>
            <button
              type="button"
              onClick={() => void me.refetch()}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-700"
            >
              {t('home.retry')}
            </button>
          </div>
        ) : null}
        {me.data ? (
          <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="font-medium">{t('home.name')}</dt>
            <dd>{me.data.name ?? me.data.username ?? t('home.notSet')}</dd>
            <dt className="font-medium">{t('home.email')}</dt>
            <dd>{me.data.email ?? t('home.notSet')}</dd>
            <dt className="font-medium">{t('home.groups')}</dt>
            <dd>{me.data.groups.length > 0 ? me.data.groups.join(', ') : t('home.noGroups')}</dd>
          </dl>
        ) : null}
      </section>
    </>
  )
}
