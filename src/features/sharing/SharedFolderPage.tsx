import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { secondaryButton } from '@/components/styles'

import { reasonOf } from './failures'
import { SharedFolder } from './SharedFolder'
import type { SharedFileItem } from './types'
import { useSharedContents, useSharedDownload, useSharedWithMe } from './useSharedWithMe'

/**
 * A folder shared with the signed-in user: its contents as the share allows (vaultgate
 * ADR 0020), each file downloaded against the share's one download limit.
 */
export function SharedFolderPage() {
  const { t, i18n } = useTranslation()
  const { shareId = '' } = useParams()
  const [folderId, setFolderId] = useState<string | undefined>(undefined)
  const shared = useSharedWithMe()
  const contents = useSharedContents(shareId, folderId)
  const download = useSharedDownload()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const share = shared.data?.find((item) => item.share_id === shareId)

  const onDownload = (file: SharedFileItem) => {
    setNotice(null)
    download.mutate(
      { shareId, fileId: file.id },
      {
        onSuccess: () => setNotice({ kind: 'ok', text: t('shared.started', { name: file.name }) }),
        onError: (error) =>
          setNotice({
            kind: 'error',
            text: t(`shared.downloadFailed.${reasonOf(error)}`, { name: file.name }),
          }),
      },
    )
  }

  const back = (
    <p className="mb-6">
      <Link to="/shared" className="underline">
        {t('sharedFolder.back')}
      </Link>
    </p>
  )

  if (contents.isError) {
    const reason = reasonOf(contents.error)
    const gone = reason === 'notFound' || reason === 'gone'
    return (
      <>
        <PageHeading title={t('sharedFolder.titleLoading')} />
        <div role="alert" className="mb-4">
          <p className="mb-3">{gone ? t('sharedFolder.gone') : t('sharedFolder.failed')}</p>
          {gone ? null : (
            <button
              type="button"
              className={secondaryButton}
              onClick={() => void contents.refetch()}
            >
              {t('shared.retry')}
            </button>
          )}
        </div>
        {back}
      </>
    )
  }

  return (
    <>
      <PageHeading title={share?.name ?? t('sharedFolder.titleLoading')}>
        {share
          ? t('sharedFolder.details', {
              sharer: share.shared_by ?? t('shared.unknownSharer'),
              expires: formatDateTime(share.expires_at, i18n.language),
              count: share.downloads_left,
            })
          : null}
      </PageHeading>
      {back}
      <div aria-live="polite">
        {notice ? (
          <p
            className={`mb-4 font-medium ${notice.kind === 'error' ? 'text-seal' : 'text-accent'}`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>
      {contents.isPending ? <p role="status">{t('sharedFolder.loading')}</p> : null}
      {contents.data ? (
        <SharedFolder
          contents={contents.data}
          onOpen={(id) => {
            setNotice(null)
            setFolderId(id)
          }}
          onDownload={onDownload}
          downloading={download.isPending ? (download.variables.fileId ?? null) : null}
        />
      ) : null}
    </>
  )
}
