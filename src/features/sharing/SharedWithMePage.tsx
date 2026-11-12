import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatBytes, formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { secondaryButton } from '@/components/styles'

import { reasonOf } from './failures'
import type { SharedFile } from './types'
import { useSharedDownload, useSharedWithMe } from './useSharedWithMe'

/** Files other users shared with the signed-in user's verified address. */
export function SharedWithMePage() {
  const { t, i18n } = useTranslation()
  const shared = useSharedWithMe()
  const download = useSharedDownload()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const onDownload = (file: SharedFile) => {
    setNotice(null)
    download.mutate(file.share_id, {
      onSuccess: () => setNotice({ kind: 'ok', text: t('shared.started', { name: file.name }) }),
      onError: (error) =>
        setNotice({
          kind: 'error',
          text: t(`shared.downloadFailed.${reasonOf(error)}`, { name: file.name }),
        }),
    })
  }

  return (
    <>
      <PageHeading title={t('shared.title')}>{t('shared.intro')}</PageHeading>

      <div aria-live="polite">
        {notice ? (
          <p
            className={`mb-4 font-medium ${notice.kind === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-800 dark:text-emerald-300'}`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      {shared.isPending ? <p role="status">{t('shared.loading')}</p> : null}
      {shared.isError ? (
        <div role="alert">
          <p className="mb-3">{t('shared.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void shared.refetch()}>
            {t('shared.retry')}
          </button>
        </div>
      ) : null}
      {shared.data && shared.data.length === 0 ? <p>{t('shared.empty')}</p> : null}

      {shared.data && shared.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{t('shared.tableCaption')}</caption>
            <thead className="border-b border-slate-200 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('shared.name')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('shared.size')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('shared.from')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('shared.expires')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('shared.left')}
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">{t('shared.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shared.data.map((file) => (
                <tr key={file.share_id} className="border-b border-slate-100 dark:border-slate-900">
                  <th scope="row" className="max-w-xs truncate py-3 pr-4 font-medium">
                    {file.name}
                  </th>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {file.size === null ? '' : formatBytes(file.size, i18n.language)}
                  </td>
                  <td className="py-3 pr-4">{file.shared_by ?? t('shared.unknownSharer')}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatDateTime(file.expires_at, i18n.language)}
                  </td>
                  <td className="py-3 pr-4">{file.downloads_left}</td>
                  <td className="py-3 text-right">
                    {file.available ? (
                      <button
                        type="button"
                        className={secondaryButton}
                        disabled={download.isPending && download.variables === file.share_id}
                        onClick={() => onDownload(file)}
                        aria-label={t('shared.downloadName', { name: file.name })}
                      >
                        {t('shared.download')}
                      </button>
                    ) : (
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {t('shared.unavailable')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )
}
