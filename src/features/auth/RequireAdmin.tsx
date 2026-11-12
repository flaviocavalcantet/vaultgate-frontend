import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { PageHeading } from '@/components/PageHeading'
import { secondaryButton } from '@/components/styles'

import { useMe } from './useMe'

/**
 * The routes inside are for administrators, as the API says (`is_admin` on /me, from its
 * admin groups). Like RequireAuth it decides what the page shows, nothing more: the API
 * refuses every admin request from anyone else.
 */
export function RequireAdmin() {
  const { t } = useTranslation()
  const me = useMe()
  if (me.isPending) return <p role="status">{t('admin.checking')}</p>
  if (me.isError) {
    return (
      <div role="alert">
        <p className="mb-3">{t('admin.checkFailed')}</p>
        <button type="button" className={secondaryButton} onClick={() => void me.refetch()}>
          {t('admin.retry')}
        </button>
      </div>
    )
  }
  if (!me.data.is_admin) {
    return <PageHeading title={t('admin.notAdmin')}>{t('admin.notAdminBody')}</PageHeading>
  }
  return <Outlet />
}
