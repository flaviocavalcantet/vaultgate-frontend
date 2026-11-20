import { useTranslation } from 'react-i18next'

import { formatBytes } from '@/components/format'
import { secondaryButton } from '@/components/styles'

import type { SharedContents, SharedFileItem } from './types'

const crumb = 'underline underline-offset-2 hover:text-accent'

/**
 * A folder of a shared folder, as its recipient sees it (vaultgate ADR 0020): the way
 * back up to the shared folder (never above it), its folders, and the files that can be
 * downloaded now. Files being scanned or held aren't listed, so the page says why the
 * list may be shorter than the owner's. Moving between folders stays in the page.
 */
export function SharedFolder({
  contents,
  onOpen,
  onDownload,
  downloading,
}: {
  contents: SharedContents
  /** Open a folder of the share; none for the shared folder itself. */
  onOpen: (folderId: string | undefined) => void
  onDownload: (file: SharedFileItem) => void
  /** The file whose download is being asked for. */
  downloading: string | null
}) {
  const { t, i18n } = useTranslation()
  const root = contents.path[0]?.id
  const open = (id: string) => onOpen(id === root ? undefined : id)
  const nothing = contents.folders.length === 0 && contents.files.length === 0

  return (
    <div>
      <nav aria-label={t('sharedFolder.path')} className="mb-3 text-sm">
        <ol className="flex flex-wrap items-center gap-x-1 text-graphite">
          {contents.path.map((step, index) => (
            <li key={step.id} className="flex items-center gap-x-1">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {index === contents.path.length - 1 ? (
                <span aria-current="page" className="font-medium text-ink">
                  {step.name}
                </span>
              ) : (
                <button type="button" className={crumb} onClick={() => open(step.id)}>
                  {step.name}
                </button>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <p className="mb-4 text-sm text-graphite">{t('sharedFolder.onlyReady')}</p>

      {nothing ? <p>{t('sharedFolder.empty')}</p> : null}
      {nothing ? null : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">
              {t('sharedFolder.caption', { name: contents.folder.name })}
            </caption>
            <thead className="border-b border-rule text-sm text-graphite">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('sharedFolder.name')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('sharedFolder.size')}
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">{t('sharedFolder.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contents.folders.map((folder) => (
                <tr key={folder.id} className="border-b border-rule">
                  <th scope="row" className="max-w-xs truncate py-3 pr-4 font-medium">
                    {folder.name}
                  </th>
                  <td className="py-3 pr-4 text-graphite">{t('sharedFolder.folder')}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => open(folder.id)}
                      aria-label={t('sharedFolder.open', { name: folder.name })}
                    >
                      {t('sharedFolder.openAction')}
                    </button>
                  </td>
                </tr>
              ))}
              {contents.files.map((file) => (
                <tr key={file.id} className="border-b border-rule">
                  <th scope="row" className="max-w-xs truncate py-3 pr-4 font-medium">
                    {file.name}
                  </th>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {file.size === null ? '' : formatBytes(file.size, i18n.language)}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={downloading === file.id}
                      onClick={() => onDownload(file)}
                      aria-label={t('sharedFolder.downloadName', { name: file.name })}
                    >
                      {t('sharedFolder.download')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {contents.truncated ? (
        <p className="mt-3 text-sm text-graphite">{t('sharedFolder.truncated')}</p>
      ) : null}
    </div>
  )
}
