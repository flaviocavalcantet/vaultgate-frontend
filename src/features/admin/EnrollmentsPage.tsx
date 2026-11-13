import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { reasonOf } from './failures'
import { Pager } from './Pager'
import { ShownOnce } from './ShownOnce'
import type { Approval, Enrollment } from './types'
import { PAGE_SIZE, useApprove, useEnrollments, useReject } from './useNodes'
import { useShowAll } from './useShowAll'

const field =
  'mt-1 block w-full max-w-xl rounded border border-control bg-surface px-3 py-2 font-mono text-sm'

/** Machines asking for a node certificate, approved by fingerprint, or rejected. */
export function EnrollmentsPage() {
  const { t } = useTranslation()
  const view = useShowAll()
  const requests = useEnrollments(view.all, view.page)
  const showId = useId()
  // Page-level: a rejected request leaves the list of waiting ones.
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <>
      <PageHeading title={t('admin.enrollments.title')}>{t('admin.enrollments.intro')}</PageHeading>
      <div className="mb-4">
        <label htmlFor={showId} className="mr-2 font-medium">
          {t('admin.enrollments.show')}
        </label>
        <select
          id={showId}
          value={view.all ? 'all' : 'waiting'}
          onChange={(event) => view.set({ all: event.target.value === 'all' })}
          className="rounded border border-control bg-surface px-2 py-1.5"
        >
          <option value="waiting">{t('admin.enrollments.waiting')}</option>
          <option value="all">{t('admin.enrollments.all')}</option>
        </select>
      </div>
      <div aria-live="polite">{notice ? <p className="mb-4 font-medium">{notice}</p> : null}</div>
      {requests.isPending ? <p role="status">{t('admin.enrollments.loading')}</p> : null}
      {requests.isError ? (
        <div role="alert">
          <p className="mb-3">{t('admin.enrollments.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void requests.refetch()}>
            {t('admin.enrollments.retry')}
          </button>
        </div>
      ) : null}
      {requests.data && requests.data.items.length === 0 ? (
        <p>{t(view.all ? 'admin.enrollments.emptyAll' : 'admin.enrollments.empty')}</p>
      ) : null}
      {requests.data && requests.data.items.length > 0 ? (
        <>
          <ul aria-label={t('admin.enrollments.list')} className="space-y-4">
            {requests.data.items.map((request) => (
              <li key={request.id}>
                <Request
                  request={request}
                  onRejected={() =>
                    setNotice(t('admin.enrollments.rejected', { name: request.name }))
                  }
                />
              </li>
            ))}
          </ul>
          <Pager
            label={t('admin.enrollments.list')}
            page={view.page}
            size={PAGE_SIZE}
            total={requests.data.total}
            onPage={(page) => view.set({ page })}
          />
        </>
      ) : null}
    </>
  )
}

function Request({ request, onRejected }: { request: Enrollment; onRejected: () => void }) {
  const { t, i18n } = useTranslation()
  const headingId = useId()
  const [approval, setApproval] = useState<Approval | null>(null)
  const when = (iso: string) => formatDateTime(iso, i18n.language)
  // While a request waits, its fingerprint isn't shown: the administrator confirms the
  // one the node's operator reads them, rather than one copied from this page.
  const showFingerprint = request.status !== 'pending'

  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-rule p-4">
      <h2 id={headingId} className="mb-2 text-xl font-semibold">
        {request.name}{' '}
        <span className="text-base font-normal text-graphite">
          {t(`admin.enrollments.states.${request.status}`)}
        </span>
      </h2>
      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="font-medium">{t('admin.enrollments.identity')}</dt>
        <dd className="font-mono break-all">{request.identity}</dd>
        <dt className="font-medium">{t('admin.enrollments.method')}</dt>
        <dd className="font-mono">
          {request.method}
          {request.client_id ? ` (${request.client_id})` : ''}
        </dd>
        <dt className="font-medium">{t('admin.enrollments.from')}</dt>
        <dd className="font-mono">{request.client_ip ?? ''}</dd>
        <dt className="font-medium">{t('admin.enrollments.requested')}</dt>
        <dd>{when(request.created_at)}</dd>
        <dt className="font-medium">{t('admin.enrollments.expires')}</dt>
        <dd>{when(request.expires_at)}</dd>
        {showFingerprint ? (
          <>
            <dt className="font-medium">{t('admin.enrollments.fingerprint')}</dt>
            <dd className="font-mono break-all">{request.key_fingerprint}</dd>
          </>
        ) : null}
      </dl>
      {request.status === 'approved' && request.code_expires_at && !approval ? (
        <p className="mb-3 text-sm">
          {t('admin.enrollments.codeUntil', { when: when(request.code_expires_at) })}
        </p>
      ) : null}
      <div aria-live="polite">
        {approval ? <Code name={request.name} approval={approval} /> : null}
      </div>
      {request.status === 'pending' && !approval ? (
        <Decide request={request} onApproved={setApproval} onRejected={onRejected} />
      ) : null}
    </article>
  )
}

function Decide({
  request,
  onApproved,
  onRejected,
}: {
  request: Enrollment
  onApproved: (approval: Approval) => void
  onRejected: () => void
}) {
  const { t } = useTranslation()
  const approve = useApprove(request.id)
  const reject = useReject(request.id)
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle')
  const [fingerprint, setFingerprint] = useState('')
  const id = useId()

  if (mode === 'approve') {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          approve.mutate(fingerprint.trim(), { onSuccess: onApproved })
        }}
      >
        <div>
          <label htmlFor={id} className="font-medium">
            {t('admin.enrollments.confirm')}
          </label>
          <input
            id={id}
            required
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            value={fingerprint}
            aria-describedby={`${id}-hint`}
            onChange={(event) => setFingerprint(event.target.value)}
            className={field}
          />
          <p id={`${id}-hint`} className="mt-1 text-sm text-graphite">
            {t('admin.enrollments.confirmHint')}
          </p>
        </div>
        <div aria-live="polite">
          {approve.isError ? (
            <p className="font-medium text-seal">
              {t(`admin.enrollments.approveFailed.${reasonOf(approve.error)}`)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className={primaryButton}
            disabled={approve.isPending || fingerprint.trim() === ''}
          >
            {approve.isPending
              ? t('admin.enrollments.approving')
              : t('admin.enrollments.confirmSubmit')}
          </button>
          <button type="button" className={secondaryButton} onClick={() => setMode('idle')}>
            {t('admin.enrollments.cancel')}
          </button>
        </div>
      </form>
    )
  }
  if (mode === 'reject') {
    return (
      <div role="group" aria-label={t('admin.enrollments.rejectName', { name: request.name })}>
        <p className="mb-3 font-medium">
          {t('admin.enrollments.rejectConfirm', { name: request.name })}
        </p>
        <div aria-live="polite">
          {reject.isError ? (
            <p className="mb-3 font-medium text-seal">
              {t('admin.enrollments.rejectFailed', { name: request.name })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={primaryButton}
            disabled={reject.isPending}
            onClick={() => reject.mutate(undefined, { onSuccess: onRejected })}
          >
            {t('admin.enrollments.rejectYes')}
          </button>
          <button type="button" className={secondaryButton} onClick={() => setMode('idle')}>
            {t('admin.enrollments.rejectNo')}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className={primaryButton}
        aria-label={t('admin.enrollments.approveName', { name: request.name })}
        onClick={() => setMode('approve')}
      >
        {t('admin.enrollments.approve')}
      </button>
      <button
        type="button"
        className={secondaryButton}
        aria-label={t('admin.enrollments.rejectName', { name: request.name })}
        onClick={() => setMode('reject')}
      >
        {t('admin.enrollments.reject')}
      </button>
    </div>
  )
}

/** The one-time code, shown once, for the node's operator. */
function Code({ name, approval }: { name: string; approval: Approval }) {
  const { t, i18n } = useTranslation()
  return (
    <ShownOnce
      intro={t('admin.enrollments.approved', { name })}
      label={t('admin.enrollments.codeLabel', { name })}
      value={approval.code}
      hint={t('admin.enrollments.codeHint', {
        when: formatDateTime(approval.code_expires_at, i18n.language),
      })}
    />
  )
}
