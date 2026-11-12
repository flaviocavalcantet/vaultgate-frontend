import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { formatBytes, formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { secondaryButton } from '@/components/styles'

import { type Verdict as VerdictName, VERDICTS } from './types'
import { PAGE_SIZE, useAdminFiles } from './useQuarantine'
import { Verdict } from './Verdict'

/** The filter and the page live in the address, so a view can be linked and reloaded. */
function useView() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('verdict')
  // Quarantined first: the files waiting on an administrator.
  const verdict: VerdictName | null =
    raw === 'all' ? null : (VERDICTS.find((v) => v === raw) ?? 'quarantined')
  const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0)
  const set = (next: { verdict?: VerdictName | null; page?: number }) => {
    const v = next.verdict === undefined ? verdict : next.verdict
    const p = next.page ?? 0
    setParams({ verdict: v ?? 'all', ...(p > 0 ? { page: String(p) } : {}) })
  }
  return { verdict, page, set }
}

/** Every user's files with their scan, filtered by verdict. */
export function AdminFilesPage() {
  const { t, i18n } = useTranslation()
  const view = useView()
  const files = useAdminFiles(view.verdict, view.page)
  const filterId = useId()

  const total = files.data?.total ?? 0
  const from = total === 0 ? 0 : view.page * PAGE_SIZE + 1
  const to = Math.min((view.page + 1) * PAGE_SIZE, total)

  return (
    <>
      <PageHeading title={t('admin.files.title')}>{t('admin.files.intro')}</PageHeading>
      <div className="mb-4">
        <label htmlFor={filterId} className="mr-2 font-medium">
          {t('admin.files.filter')}
        </label>
        <select
          id={filterId}
          value={view.verdict ?? 'all'}
          onChange={(event) =>
            view.set({
              verdict: event.target.value === 'all' ? null : (event.target.value as VerdictName),
            })
          }
          className="rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="all">{t('admin.files.all')}</option>
          {VERDICTS.map((verdict) => (
            <option key={verdict} value={verdict}>
              {t(`admin.verdicts.${verdict}`)}
            </option>
          ))}
        </select>
      </div>

      {files.isPending ? <p role="status">{t('admin.files.loading')}</p> : null}
      {files.isError ? (
        <div role="alert">
          <p className="mb-3">{t('admin.files.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void files.refetch()}>
            {t('admin.files.retry')}
          </button>
        </div>
      ) : null}
      {files.data && files.data.items.length === 0 ? <p>{t('admin.files.empty')}</p> : null}

      {files.data && files.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('admin.files.tableCaption')}</caption>
              <thead className="border-b border-slate-200 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.files.name')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.files.owner')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.files.size')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.files.uploaded')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {t('admin.files.verdict')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.data.items.map((file) => (
                  <tr key={file.id} className="border-b border-slate-100 dark:border-slate-900">
                    <th scope="row" className="max-w-xs truncate py-3 pr-4 font-medium">
                      <Link to={`/admin/files/${file.id}`} className="underline">
                        {file.name}
                      </Link>
                    </th>
                    <td className="py-3 pr-4">
                      {file.owner_username ?? t('admin.files.unknownOwner')}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatBytes(file.size ?? file.declared_size, i18n.language)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {file.uploaded_at ? formatDateTime(file.uploaded_at, i18n.language) : ''}
                    </td>
                    <td className="py-3">
                      <Verdict file={file} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav
            aria-label={t('admin.files.pagination')}
            className="mt-4 flex items-center justify-between gap-4 text-sm"
          >
            <p>{t('admin.files.showing', { from, to, total })}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={view.page === 0}
                onClick={() => view.set({ page: view.page - 1 })}
              >
                {t('admin.files.previous')}
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={to >= total}
                onClick={() => view.set({ page: view.page + 1 })}
              >
                {t('admin.files.next')}
              </button>
            </div>
          </nav>
        </>
      ) : null}
    </>
  )
}
