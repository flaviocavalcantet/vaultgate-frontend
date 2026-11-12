import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { secondaryButton } from '@/components/styles'

import { reasonOf } from './failures'
import { useUser } from './useDirectory'

/** One user as VaultGate knows them, with the ways in from here: access, and events. */
export function UserPage() {
  const { t, i18n } = useTranslation()
  const { userId = '' } = useParams()
  const user = useUser(userId)

  const back = (
    <p className="mb-6">
      <Link to="/admin/users" className="underline">
        {t('admin.user.back')}
      </Link>
    </p>
  )
  if (user.isPending) {
    return (
      <>
        <PageHeading title={t('admin.user.titleLoading')} />
        <p role="status">{t('admin.user.loading')}</p>
      </>
    )
  }
  if (user.isError) {
    return (
      <>
        <PageHeading title={t('admin.user.titleLoading')} />
        <p role="alert" className="mb-4">
          {t(`admin.user.failed.${reasonOf(user.error)}`)}
        </p>
        {back}
      </>
    )
  }
  const u = user.data
  const notSet = t('admin.users.notSet')
  return (
    <>
      <PageHeading title={u.name ?? u.username ?? u.subject} />
      {back}
      <dl className="mb-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="font-medium">{t('admin.user.id')}</dt>
        <dd className="font-mono text-sm break-all">{u.id}</dd>
        <dt className="font-medium">{t('admin.user.username')}</dt>
        <dd>{u.username ?? notSet}</dd>
        <dt className="font-medium">{t('admin.users.email')}</dt>
        <dd>{u.email ?? notSet}</dd>
        <dt className="font-medium">{t('admin.users.groups')}</dt>
        <dd>{u.groups.length > 0 ? u.groups.join(', ') : t('admin.users.none')}</dd>
        <dt className="font-medium">{t('admin.users.role')}</dt>
        <dd>{u.is_admin ? t('admin.users.admin') : t('admin.users.member')}</dd>
        <dt className="font-medium">{t('admin.users.status')}</dt>
        <dd>{u.is_active ? t('admin.users.active') : t('admin.users.inactive')}</dd>
        <dt className="font-medium">{t('admin.user.joined')}</dt>
        <dd>{formatDateTime(u.created_at, i18n.language)}</dd>
        <dt className="font-medium">{t('admin.users.lastSignIn')}</dt>
        <dd>
          {u.last_login_at
            ? formatDateTime(u.last_login_at, i18n.language)
            : t('admin.users.never')}
        </dd>
        <dt className="font-medium">{t('admin.user.issuer')}</dt>
        <dd className="break-all">{u.issuer}</dd>
        <dt className="font-medium">{t('admin.user.subject')}</dt>
        <dd className="font-mono text-sm break-all">{u.subject}</dd>
      </dl>
      <div className="flex flex-wrap gap-3">
        <Link
          to={`/admin/evaluate?${new URLSearchParams({ user: u.id }).toString()}`}
          className={secondaryButton}
        >
          {t('admin.user.checkAccess')}
        </Link>
        <Link
          to={`/admin/audit?${new URLSearchParams({ actor: u.id }).toString()}`}
          className={secondaryButton}
        >
          {t('admin.user.events')}
        </Link>
      </div>
    </>
  )
}
