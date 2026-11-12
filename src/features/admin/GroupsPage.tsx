import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { secondaryButton } from '@/components/styles'

import { Pager } from './Pager'
import { PAGE_SIZE, useGroups } from './useDirectory'

/** The groups seen in sign-in tokens, with their member counts. */
export function GroupsPage() {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(0)
  const groups = useGroups(page)

  return (
    <>
      <PageHeading title={t('admin.groups.title')}>{t('admin.groups.intro')}</PageHeading>
      {groups.isPending ? <p role="status">{t('admin.groups.loading')}</p> : null}
      {groups.isError ? (
        <div role="alert">
          <p className="mb-3">{t('admin.groups.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void groups.refetch()}>
            {t('admin.groups.retry')}
          </button>
        </div>
      ) : null}
      {groups.data && groups.data.items.length === 0 ? <p>{t('admin.groups.empty')}</p> : null}
      {groups.data && groups.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('admin.groups.tableCaption')}</caption>
              <thead className="border-b border-slate-200 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.groups.name')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.groups.members')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.groups.firstSeen')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">{t('admin.groups.check')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.data.items.map((group) => (
                  <tr key={group.id} className="border-b border-slate-100 dark:border-slate-900">
                    <th scope="row" className="py-3 pr-4 font-mono text-sm font-medium">
                      {group.name}
                    </th>
                    <td className="py-3 pr-4">{group.members}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDateTime(group.created_at, i18n.language)}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/admin/evaluate?${new URLSearchParams({ group: group.name }).toString()}`}
                        className={secondaryButton}
                        aria-label={t('admin.groups.checkName', { name: group.name })}
                      >
                        {t('admin.groups.check')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            label={t('admin.groups.pagination')}
            page={page}
            size={PAGE_SIZE}
            total={groups.data.total}
            onPage={setPage}
          />
        </>
      ) : null}
    </>
  )
}
