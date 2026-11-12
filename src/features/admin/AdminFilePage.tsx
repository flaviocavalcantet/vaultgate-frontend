import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { formatBytes, formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { reasonOf } from './failures'
import type { AdminFile, Purpose } from './types'
import { useAdminFile, useRelease, useRescan } from './useQuarantine'
import { Verdict } from './Verdict'

const field =
  'mt-1 block w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950'

/** One file's scan, and what an administrator can do about it: release, or scan again. */
export function AdminFilePage() {
  const { t } = useTranslation()
  const { fileId = '' } = useParams()
  const file = useAdminFile(fileId)

  const back = (
    <p className="mb-6">
      <Link to="/admin/files" className="underline">
        {t('admin.file.back')}
      </Link>
    </p>
  )
  if (file.isPending) {
    return (
      <>
        <PageHeading title={t('admin.file.titleLoading')} />
        <p role="status">{t('admin.file.loading')}</p>
      </>
    )
  }
  if (file.isError) {
    return (
      <>
        <PageHeading title={t('admin.file.titleLoading')} />
        <p role="alert" className="mb-4">
          {t(`admin.file.failed.${reasonOf(file.error)}`)}
        </p>
        {back}
      </>
    )
  }
  const verdict = file.data.scan?.verdict
  return (
    <>
      <PageHeading title={file.data.name} />
      {back}
      <Details file={file.data} />
      {verdict === 'quarantined' || verdict === 'unscannable' ? <Release file={file.data} /> : null}
      {file.data.status === 'uploaded' ? <Rescan file={file.data} /> : null}
    </>
  )
}

function Details({ file }: { file: AdminFile }) {
  const { t, i18n } = useTranslation()
  const scan = file.scan
  const allowed = [
    file.downloadable ? t('admin.file.download') : null,
    file.shareable ? t('admin.file.share') : null,
  ].filter((part) => part !== null)
  return (
    <section aria-labelledby="details" className="mb-10">
      <h2 id="details" className="mb-3 text-lg font-semibold">
        {t('admin.file.details')}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="font-medium">{t('admin.file.owner')}</dt>
        <dd>{file.owner_username ?? t('admin.files.unknownOwner')}</dd>
        <dt className="font-medium">{t('admin.file.type')}</dt>
        <dd>{file.content_type}</dd>
        <dt className="font-medium">{t('admin.file.size')}</dt>
        <dd>{formatBytes(file.size ?? file.declared_size, i18n.language)}</dd>
        <dt className="font-medium">{t('admin.file.uploaded')}</dt>
        <dd>{file.uploaded_at ? formatDateTime(file.uploaded_at, i18n.language) : ''}</dd>
        <dt className="font-medium">{t('admin.file.sha256')}</dt>
        <dd className="font-mono text-sm break-all">{file.sha256 ?? ''}</dd>
        <dt className="font-medium">{t('admin.file.scan')}</dt>
        <dd>
          <Verdict file={file} />
        </dd>
        <dt className="font-medium">{t('admin.file.scannedAt')}</dt>
        <dd>
          {scan?.scanned_at
            ? formatDateTime(scan.scanned_at, i18n.language)
            : t('admin.file.notScanned')}
        </dd>
        {scan?.reason ? (
          <>
            <dt className="font-medium">{t('admin.file.reason')}</dt>
            <dd>{scan.reason}</dd>
          </>
        ) : null}
        <dt className="font-medium">{t('admin.file.findings')}</dt>
        <dd>
          {scan && scan.findings.length > 0 ? (
            <>
              <ul>
                {scan.findings.map((finding) => (
                  <li key={finding.kind}>
                    {t('admin.file.finding', { kind: finding.kind, count: finding.count })}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t('admin.file.findingsNote')}
              </p>
            </>
          ) : (
            t('admin.file.noFindings')
          )}
        </dd>
        <dt className="font-medium">{t('admin.file.releases')}</dt>
        <dd>
          {scan && scan.releases.length > 0 ? (
            <ul>
              {scan.releases.map((release) => (
                <li key={release.purpose}>
                  {t('admin.file.releasedAt', {
                    purpose: t(`admin.file.releaseFor.${release.purpose}`),
                    when: formatDateTime(release.released_at, i18n.language),
                    reason: release.reason,
                  })}
                </li>
              ))}
            </ul>
          ) : (
            t('admin.file.noReleases')
          )}
        </dd>
        <dt className="font-medium">{t('admin.file.allowed')}</dt>
        <dd>{allowed.length > 0 ? allowed.join(', ') : t('admin.file.nothing')}</dd>
      </dl>
    </section>
  )
}

function Release({ file }: { file: AdminFile }) {
  const { t } = useTranslation()
  const release = useRelease(file.id)
  const released = new Set(file.scan?.releases.map((r) => r.purpose))
  const open: Purpose[] = (['download', 'share'] as const).filter((p) => !released.has(p))
  const [purpose, setPurpose] = useState<Purpose>(open[0] ?? 'download')
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<Purpose | null>(null)
  const ids = { heading: useId(), reason: useId(), hint: useId() }

  if (open.length === 0 && done === null) return null
  const chosen = open.includes(purpose) ? purpose : (open[0] ?? purpose)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setDone(null)
    release.mutate(
      { purpose: chosen, reason: reason.trim() },
      {
        onSuccess: () => {
          setDone(chosen)
          setReason('')
        },
      },
    )
  }

  return (
    <section aria-labelledby={ids.heading} className="mb-10">
      <h2 id={ids.heading} className="mb-2 text-lg font-semibold">
        {t('admin.file.release')}
      </h2>
      <p className="mb-4 max-w-2xl text-slate-600 dark:text-slate-300">
        {t('admin.file.releaseIntro')}
      </p>
      <div aria-live="polite" className="mb-4">
        {done ? (
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            {t(`admin.file.released.${done}`)}
          </p>
        ) : null}
        {release.isError ? (
          <p className="font-medium text-rose-700 dark:text-rose-300">
            {t(`admin.file.releaseFailed.${reasonOf(release.error)}`)}
          </p>
        ) : null}
      </div>
      {open.length > 0 ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <fieldset>
            <legend className="font-medium">{t('admin.file.purpose')}</legend>
            {open.map((value) => (
              <label key={value} className="mt-2 flex items-center gap-2">
                <input
                  type="radio"
                  name="release-purpose"
                  value={value}
                  checked={chosen === value}
                  onChange={() => setPurpose(value)}
                />
                {t(value === 'download' ? 'admin.file.purposeDownload' : 'admin.file.purposeShare')}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor={ids.reason} className="font-medium">
              {t('admin.file.releaseReason')}
            </label>
            <textarea
              id={ids.reason}
              required
              maxLength={500}
              rows={3}
              aria-describedby={ids.hint}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={field}
            />
            <p id={ids.hint} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t('admin.file.releaseReasonHint')}
            </p>
          </div>
          <button
            type="submit"
            className={primaryButton}
            disabled={release.isPending || reason.trim() === ''}
          >
            {release.isPending ? t('admin.file.releasing') : t('admin.file.releaseSubmit')}
          </button>
        </form>
      ) : null}
    </section>
  )
}

function Rescan({ file }: { file: AdminFile }) {
  const { t } = useTranslation()
  const rescan = useRescan(file.id)
  const [confirming, setConfirming] = useState(false)
  const headingId = useId()
  const waiting = file.scan === null || file.scan.verdict === 'pending'

  const onConfirm = () => {
    rescan.mutate(undefined, { onSettled: () => setConfirming(false) })
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 text-lg font-semibold">
        {t('admin.file.rescan')}
      </h2>
      <p className="mb-4 max-w-2xl text-slate-600 dark:text-slate-300">
        {t('admin.file.rescanIntro')}
      </p>
      <div aria-live="polite" className="mb-4">
        {rescan.isSuccess ? (
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            {t('admin.file.rescanned')}
          </p>
        ) : null}
        {rescan.isError ? (
          <p className="font-medium text-rose-700 dark:text-rose-300">
            {t(`admin.file.rescanFailed.${reasonOf(rescan.error)}`)}
          </p>
        ) : null}
      </div>
      {confirming ? (
        <div role="group" aria-label={t('admin.file.rescan')} className="space-y-3">
          <p className="font-medium">{t('admin.file.rescanConfirm', { name: file.name })}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={primaryButton}
              disabled={rescan.isPending}
              onClick={onConfirm}
            >
              {rescan.isPending ? t('admin.file.rescanning') : t('admin.file.rescanYes')}
            </button>
            <button type="button" className={secondaryButton} onClick={() => setConfirming(false)}>
              {t('admin.file.rescanNo')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={secondaryButton}
          // A file waiting for its verdict is already being scanned.
          disabled={waiting}
          onClick={() => setConfirming(true)}
        >
          {t('admin.file.rescan')}
        </button>
      )}
    </section>
  )
}
