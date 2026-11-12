import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatBytes, formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton as primary, secondaryButton as secondary } from '@/components/styles'

import { FileState } from './FileState'
import type { FileOut } from './types'
import { UploadList } from './UploadList'
import { DownloadRefused, useDownload } from './useDownload'
import { PAGE_SIZE, useFiles } from './useFiles'
import { useUploads } from './useUploads'

export function FilesPage() {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(0)
  const files = useFiles(page)
  const uploads = useUploads()
  const download = useDownload()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inputId = useId()

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    // Picking the same file again must fire a change: clear the input.
    event.target.value = ''
    setPage(0)
    picked.forEach((file) => void uploads.start(file))
  }

  const onDownload = (file: FileOut) => {
    setNotice(null)
    download.mutate(file.id, {
      onSuccess: () =>
        setNotice({ kind: 'ok', text: t('files.downloadStarted', { name: file.name }) }),
      onError: (error) => {
        const reason = error instanceof DownloadRefused ? error.reason : 'unknown'
        setNotice({ kind: 'error', text: t(`files.downloadFailed.${reason}`, { name: file.name }) })
      },
    })
  }

  const total = files.data?.total ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeading title={t('files.title')}>{t('files.intro')}</PageHeading>
        <label htmlFor={inputId} className={primary}>
          {t('upload.choose')}
          <input id={inputId} type="file" multiple className="sr-only" onChange={onPick} />
        </label>
      </div>

      <UploadList uploads={uploads.uploads} onCancel={uploads.cancel} onDismiss={uploads.dismiss} />

      <div aria-live="polite">
        {notice ? (
          <p
            className={`mb-4 font-medium ${notice.kind === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-800 dark:text-emerald-300'}`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      {files.isPending ? <p role="status">{t('files.loading')}</p> : null}
      {files.isError ? (
        <div role="alert">
          <p className="mb-3">{t('files.failed')}</p>
          <button type="button" className={secondary} onClick={() => void files.refetch()}>
            {t('files.retry')}
          </button>
        </div>
      ) : null}

      {files.data && files.data.items.length === 0 ? <p>{t('files.empty')}</p> : null}

      {files.data && files.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('files.tableCaption')}</caption>
              <thead className="border-b border-slate-200 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('files.name')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('files.size')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('files.uploaded')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('files.status')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">{t('files.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.data.items.map((file) => (
                  <tr key={file.id} className="border-b border-slate-100 dark:border-slate-900">
                    <th scope="row" className="max-w-xs truncate py-3 pr-4 font-medium">
                      {file.name}
                    </th>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatBytes(file.size ?? file.declared_size, i18n.language)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {file.uploaded_at
                        ? formatDateTime(file.uploaded_at, i18n.language)
                        : t('files.notUploaded')}
                    </td>
                    <td className="py-3 pr-4">
                      <FileState file={file} />
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        {file.status === 'uploaded' ? (
                          <Link
                            to={`/files/${file.id}/sharing`}
                            className={secondary}
                            aria-label={t('files.shareName', { name: file.name })}
                          >
                            {t('files.share')}
                          </Link>
                        ) : null}
                        {file.downloadable ? (
                          <button
                            type="button"
                            className={secondary}
                            disabled={download.isPending && download.variables === file.id}
                            onClick={() => onDownload(file)}
                            aria-label={t('files.downloadName', { name: file.name })}
                          >
                            {t('files.download')}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav
            aria-label={t('files.pagination')}
            className="mt-4 flex items-center justify-between gap-4 text-sm"
          >
            <p>{t('files.showing', { from, to, total })}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondary}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                {t('files.previous')}
              </button>
              <button
                type="button"
                className={secondary}
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('files.next')}
              </button>
            </div>
          </nav>
        </>
      ) : null}
    </>
  )
}
