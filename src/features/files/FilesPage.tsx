import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { formatBytes, formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton as primary, secondaryButton as secondary } from '@/components/styles'

import { Breadcrumbs } from './Breadcrumbs'
import { FileState } from './FileState'
import { type Action, ItemActions } from './ItemActions'
import { folderPath } from './paths'
import type { FileOut, Item } from './types'
import { UploadList } from './UploadList'
import { DownloadRefused, useDownload } from './useDownload'
import { PAGE_SIZE, useFiles } from './useFiles'
import { ChangeRefused, useFolder, useSubfolders } from './useFolders'
import { useUploads } from './useUploads'

/** A folder, drawn beside its name; the name says what it is. */
function FolderMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 16"
      className="mr-2 inline-block h-4 w-5 shrink-0 align-[-2px] text-accent"
    >
      <path
        d="M1 3a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

/** The page's state for one folder; `key`ed by the folder, so it starts over in another. */
export function FilesPage() {
  const { folderId } = useParams()
  return <FolderView key={folderId ?? 'top'} folderId={folderId} />
}

function FolderView({ folderId }: { folderId: string | undefined }) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(0)
  const folder = useFolder(folderId)
  const subfolders = useSubfolders(folderId)
  const files = useFiles(page, folderId)
  const uploads = useUploads()
  const download = useDownload()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const inputId = useId()

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    // Picking the same file again must fire a change: clear the input.
    event.target.value = ''
    setPage(0)
    picked.forEach((file) => void uploads.start(file, folderId))
  }

  // Where focus goes back to when a panel closes: the button that opened it, or, when
  // that is gone (its row moved or deleted), New folder.
  const opener = useRef<HTMLElement | null>(null)
  const newFolder = useRef<HTMLButtonElement>(null)
  const refocus = () => {
    const back = opener.current?.isConnected ? opener.current : newFolder.current
    back?.focus()
  }

  const begin = (next: Action) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setNotice(null)
    setAction(next)
  }
  const close = () => {
    setAction(null)
    refocus()
  }
  const done = (text: string) => {
    // A row moved or deleted is about to leave the list: its buttons with it.
    if (action?.kind === 'move' || action?.kind === 'delete') opener.current = null
    close()
    setNotice({ kind: 'ok', text })
  }
  const actions = (target: Item) => {
    const name = target.item.name
    return (
      <>
        <button
          type="button"
          className={secondary}
          onClick={() => begin({ kind: 'rename', target })}
          aria-label={t('folders.renameName', { name })}
        >
          {t('folders.renameAction')}
        </button>
        <button
          type="button"
          className={secondary}
          onClick={() => begin({ kind: 'move', target })}
          aria-label={t('folders.moveName', { name })}
        >
          {t('folders.moveAction')}
        </button>
        <button
          type="button"
          className={secondary}
          onClick={() => begin({ kind: 'delete', target })}
          aria-label={t('folders.deleteName', { name })}
        >
          {t('folders.deleteAction')}
        </button>
      </>
    )
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
  // A page left past the end (its last file deleted or moved away) steps back to the
  // last page that has files: state adjusted while rendering, as React advises.
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
  if (files.data !== undefined && files.data.items.length === 0 && page > lastPage) {
    setPage(lastPage)
  }
  // Folders come first, on the first page of files.
  const folders = page === 0 ? (subfolders.data?.items ?? []) : []

  if (folderId !== undefined && folder.isError) {
    const missing = folder.error instanceof ChangeRefused && folder.error.reason === 'notFound'
    return (
      <>
        <Breadcrumbs folder={undefined} />
        <PageHeading title={t('files.title')} />
        <div role="alert">
          <p className="mb-3">{missing ? t('folders.missing') : t('folders.failed.load')}</p>
          {missing ? null : (
            <button type="button" className={secondary} onClick={() => void folder.refetch()}>
              {t('files.retry')}
            </button>
          )}
        </div>
      </>
    )
  }

  // The list shows once both halves are in, so folders don't appear above files late.
  const ready = files.data !== undefined && subfolders.data !== undefined
  const empty = ready && files.data.total === 0 && subfolders.data.items.length === 0

  return (
    <>
      <Breadcrumbs folder={folder.data} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        {folderId === undefined ? (
          <PageHeading title={t('files.title')}>{t('files.intro')}</PageHeading>
        ) : (
          <PageHeading title={folder.data?.name ?? t('folders.loading')} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={newFolder}
            type="button"
            className={secondary}
            onClick={() => begin({ kind: 'create' })}
          >
            {t('folders.new')}
          </button>
          <label htmlFor={inputId} className={primary}>
            {t('upload.choose')}
            <input id={inputId} type="file" multiple className="sr-only" onChange={onPick} />
          </label>
        </div>
      </div>

      {action ? (
        <ItemActions
          key={action.kind === 'create' ? 'create' : `${action.kind}:${action.target.item.id}`}
          action={action}
          folderId={folderId}
          onDone={done}
          onCancel={close}
        />
      ) : null}

      <UploadList uploads={uploads.uploads} onCancel={uploads.cancel} onDismiss={uploads.dismiss} />

      <div aria-live="polite">
        {notice ? (
          <p
            className={`mb-4 font-medium ${notice.kind === 'error' ? 'text-seal' : 'text-accent'}`}
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

      {empty ? <p>{folderId === undefined ? t('files.empty') : t('folders.empty')}</p> : null}

      {ready && files.data && (files.data.items.length > 0 || folders.length > 0) ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('files.tableCaption')}</caption>
              <thead className="border-b border-rule text-sm text-graphite">
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
                {folders.map((sub) => (
                  <tr key={sub.id} className="border-b border-rule">
                    <th scope="row" className="max-w-xs truncate py-3 pr-4 font-medium">
                      <FolderMark />
                      <Link
                        to={folderPath(sub.id)}
                        className="underline underline-offset-2 hover:text-accent"
                        aria-label={t('folders.open', { name: sub.name })}
                      >
                        {sub.name}
                      </Link>
                    </th>
                    <td className="py-3 pr-4 text-graphite">—</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDateTime(sub.created_at, i18n.language)}
                    </td>
                    <td className="py-3 pr-4 text-graphite">{t('folders.folder')}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {actions({ kind: 'folder', item: sub })}
                      </div>
                    </td>
                  </tr>
                ))}
                {files.data.items.map((file) => (
                  <tr key={file.id} className="border-b border-rule">
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
                      <div className="flex flex-wrap justify-end gap-2">
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
                        {actions({ kind: 'file', item: file })}
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
