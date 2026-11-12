import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { secondaryButton } from '@/components/styles'

import { Pager } from './Pager'
import { PAGE_SIZE, useUsers } from './useDirectory'

const th = 'py-2 pr-4 font-medium'
const td = 'py-3 pr-4'

/** Everyone who has signed in, with their groups, role and state. */
export function UsersPage() {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(0)
  const users = useUsers(page)

  return (
    <>
      <PageHeading title={t('admin.users.title')}>{t('admin.users.intro')}</PageHeading>
      {users.isPending ? <p role="status">{t('admin.users.loading')}</p> : null}
      {users.isError ? (
        <div role="alert">
          <p className="mb-3">{t('admin.users.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void users.refetch()}>
            {t('admin.users.retry')}
          </button>
        </div>
      ) : null}
      {users.data && users.data.items.length === 0 ? <p>{t('admin.users.empty')}</p> : null}
      {users.data && users.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('admin.users.tableCaption')}</caption>
              <thead className="border-b border-slate-200 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className={th}>
                    {t('admin.users.name')}
                  </th>
                  <th scope="col" className={th}>
                    {t('admin.users.email')}
                  </th>
                  <th scope="col" className={th}>
                    {t('admin.users.groups')}
                  </th>
                  <th scope="col" className={th}>
                    {t('admin.users.role')}
                  </th>
                  <th scope="col" className={th}>
                    {t('admin.users.status')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {t('admin.users.lastSignIn')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.items.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-100 align-top dark:border-slate-900"
                  >
                    <th scope="row" className="py-3 pr-4 font-medium">
                      <Link to={`/admin/users/${user.id}`} className="underline">
                        {user.name ?? user.username ?? user.subject}
                      </Link>
                    </th>
                    <td className={td}>{user.email ?? t('admin.users.notSet')}</td>
                    <td className={`${td} text-sm`}>
                      {user.groups.length > 0 ? user.groups.join(', ') : t('admin.users.none')}
                    </td>
                    <td className={td}>
                      {user.is_admin ? t('admin.users.admin') : t('admin.users.member')}
                    </td>
                    <td className={td}>
                      {user.is_active ? t('admin.users.active') : t('admin.users.inactive')}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {user.last_login_at
                        ? formatDateTime(user.last_login_at, i18n.language)
                        : t('admin.users.never')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            label={t('admin.users.pagination')}
            page={page}
            size={PAGE_SIZE}
            total={users.data.total}
            onPage={setPage}
          />
        </>
      ) : null}
    </>
  )
}
