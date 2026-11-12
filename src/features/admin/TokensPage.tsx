import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { ConfirmAction } from './ConfirmAction'
import { reasonOf } from './failures'
import { Pager } from './Pager'
import { ShownOnce } from './ShownOnce'
import { type EnrollmentToken, type IssuedToken, NODE_NAME } from './types'
import { PAGE_SIZE, useIssueToken, useRevokeToken, useTokens } from './useNodes'
import { useShowAll } from './useShowAll'

const field =
  'mt-1 block w-full rounded border border-control bg-surface px-3 py-2 aria-invalid:border-seal'
type Notice = { kind: 'ok' | 'error'; text: string }

/** Single-use enrollment tokens: issue one for a node name, list them, revoke unused ones. */
export function TokensPage() {
  const { t } = useTranslation()
  const view = useShowAll()
  const tokens = useTokens(view.all, view.page)
  const revoke = useRevokeToken()
  const [notice, setNotice] = useState<Notice | null>(null)
  const showId = useId()

  const onRevoke = (token: EnrollmentToken, done: () => void) =>
    revoke.mutate(token.id, {
      onSuccess: () =>
        setNotice({ kind: 'ok', text: t('admin.tokens.revoked', { name: token.name }) }),
      onError: () =>
        setNotice({ kind: 'error', text: t('admin.tokens.revokeFailed', { name: token.name }) }),
      onSettled: done,
    })

  return (
    <>
      <PageHeading title={t('admin.tokens.title')}>{t('admin.tokens.intro')}</PageHeading>
      <IssueToken />
      <div className="mb-4">
        <label htmlFor={showId} className="mr-2 font-medium">
          {t('admin.tokens.show')}
        </label>
        <select
          id={showId}
          value={view.all ? 'all' : 'usable'}
          onChange={(event) => view.set({ all: event.target.value === 'all' })}
          className="rounded border border-control bg-surface px-2 py-1.5"
        >
          <option value="usable">{t('admin.tokens.usable')}</option>
          <option value="all">{t('admin.tokens.all')}</option>
        </select>
      </div>
      <div aria-live="polite">
        {notice ? (
          <p className={`mb-4 font-medium ${notice.kind === 'error' ? 'text-seal' : ''}`}>
            {notice.text}
          </p>
        ) : null}
      </div>
      {tokens.isPending ? <p role="status">{t('admin.tokens.loading')}</p> : null}
      {tokens.isError ? (
        <div role="alert">
          <p className="mb-3">{t('admin.tokens.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void tokens.refetch()}>
            {t('admin.tokens.retry')}
          </button>
        </div>
      ) : null}
      {tokens.data && tokens.data.items.length === 0 ? (
        <p>{t(view.all ? 'admin.tokens.emptyAll' : 'admin.tokens.empty')}</p>
      ) : null}
      {tokens.data && tokens.data.items.length > 0 ? (
        <>
          <TokenTable tokens={tokens.data.items} revoking={revoke.isPending} onRevoke={onRevoke} />
          <Pager
            label={t('admin.tokens.tableCaption')}
            page={view.page}
            size={PAGE_SIZE}
            total={tokens.data.total}
            onPage={(page) => view.set({ page })}
          />
        </>
      ) : null}
    </>
  )
}

function IssueToken() {
  const { t, i18n } = useTranslation()
  const issue = useIssueToken()
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState('')
  const [nameProblem, setNameProblem] = useState(false)
  const [issued, setIssued] = useState<IssuedToken | null>(null)
  const id = useId()
  const ids = (key: string) => `${id}-${key}`

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const clean = name.trim()
    setNameProblem(!NODE_NAME.test(clean))
    if (!NODE_NAME.test(clean)) return
    const count = Number(minutes)
    const ttl = minutes.trim() === '' || !Number.isFinite(count) ? null : Math.round(count * 60)
    setIssued(null)
    issue.mutate(
      { name: clean, ttl_seconds: ttl },
      {
        onSuccess: (token) => {
          setIssued(token)
          setName('')
          setMinutes('')
        },
      },
    )
  }

  return (
    <section aria-labelledby={ids('heading')} className="mb-10">
      <h2 id={ids('heading')} className="mb-3 text-xl font-semibold">
        {t('admin.tokens.issue')}
      </h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-4">
        <div className="w-64">
          <label htmlFor={ids('name')} className="font-medium">
            {t('admin.nodeForm.name')}
          </label>
          <input
            id={ids('name')}
            required
            maxLength={63}
            autoComplete="off"
            spellCheck={false}
            value={name}
            aria-describedby={ids('name-hint')}
            aria-invalid={nameProblem || undefined}
            onChange={(event) => setName(event.target.value)}
            className={`${field} font-mono text-sm`}
          />
          <p id={ids('name-hint')} className="mt-1 text-sm text-graphite">
            {t('admin.nodeForm.nameHint')}
          </p>
        </div>
        <div className="w-48">
          <label htmlFor={ids('minutes')} className="font-medium">
            {t('admin.tokens.minutes')}
          </label>
          <input
            id={ids('minutes')}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={minutes}
            aria-describedby={ids('minutes-hint')}
            onChange={(event) => setMinutes(event.target.value)}
            className={field}
          />
          <p id={ids('minutes-hint')} className="mt-1 text-sm text-graphite">
            {t('admin.tokens.minutesHint')}
          </p>
        </div>
        <button type="submit" className={`${primaryButton} mt-7`} disabled={issue.isPending}>
          {issue.isPending ? t('admin.tokens.issuing') : t('admin.tokens.submit')}
        </button>
      </form>
      <div aria-live="polite" className="mt-4">
        {nameProblem ? (
          <p className="font-medium text-seal">{t('admin.nodeForm.nameInvalid')}</p>
        ) : null}
        {issue.isError ? (
          <p className="font-medium text-seal">
            {t(`admin.tokens.issueFailed.${reasonOf(issue.error)}`)}
          </p>
        ) : null}
        {issued ? (
          <ShownOnce
            intro={t('admin.tokens.issued', { name: issued.name })}
            label={t('admin.tokens.tokenLabel', { name: issued.name })}
            value={issued.token}
            hint={t('admin.tokens.tokenHint', {
              when: formatDateTime(issued.expires_at, i18n.language),
            })}
          />
        ) : null}
      </div>
    </section>
  )
}

function TokenTable({
  tokens,
  revoking,
  onRevoke,
}: {
  tokens: EnrollmentToken[]
  revoking: boolean
  onRevoke: (token: EnrollmentToken, done: () => void) => void
}) {
  const { t, i18n } = useTranslation()
  const when = (iso: string) => formatDateTime(iso, i18n.language)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">{t('admin.tokens.tableCaption')}</caption>
        <thead className="border-b border-rule text-sm text-graphite">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('admin.tokens.name')}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('admin.tokens.state')}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('admin.tokens.issuedAt')}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('admin.tokens.expires')}
            </th>
            <th scope="col" className="py-2 font-medium">
              <span className="sr-only">{t('admin.tokens.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.id} className="border-b border-rule align-top">
              <th scope="row" className="py-3 pr-4 font-mono text-sm font-medium">
                {token.name}
              </th>
              <td className="py-3 pr-4">
                {t(`admin.tokens.states.${token.state}`)}
                {token.used_at ? (
                  <span className="block text-sm">
                    {t('admin.tokens.usedAt', { when: when(token.used_at) })}
                  </span>
                ) : null}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap">{when(token.created_at)}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{when(token.expires_at)}</td>
              <td className="py-3 text-right">
                {token.state === 'usable' ? (
                  <ConfirmAction
                    label={t('admin.tokens.revoke')}
                    name={t('admin.tokens.revokeName', { name: token.name })}
                    question={t('admin.tokens.revokeConfirm', { name: token.name })}
                    yes={t('admin.tokens.revokeYes')}
                    no={t('admin.tokens.revokeNo')}
                    pending={revoking}
                    onConfirm={(done) => onRevoke(token, done)}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
