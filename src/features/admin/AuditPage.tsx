import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { fieldsOf, reasonOf } from './failures'
import { Pager } from './Pager'
import type { AuditEvent } from './types'
import { type AuditFilter, PAGE_SIZE, useAuditEvents, useVerifyChain } from './useAudit'

const field =
  'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 aria-invalid:border-rose-600 dark:border-slate-700 dark:bg-slate-950'
const OUTCOMES = ['ok', 'denied', 'unscannable'] as const
const KINDS = ['user', 'recipient', 'gateway', 'scanner', 'system'] as const

/** The address's names for the filters, the page's for the API. */
const PARAMS = {
  action: 'action',
  outcome: 'outcome',
  actor: 'actor',
  target: 'target',
  since: 'since',
  until: 'until',
} as const satisfies Record<keyof AuditFilter, string>

/** A local date and time from a field ("2026-11-12T09:30") as an instant, or empty. */
function instant(local: string): string {
  const date = new Date(local)
  return local === '' || Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

/** The filters live in the address, so a view can be linked (a user's events, say). */
function useView() {
  const [params, setParams] = useSearchParams()
  const form: AuditFilter = {
    action: params.get(PARAMS.action) ?? '',
    outcome: params.get(PARAMS.outcome) ?? '',
    actor: params.get(PARAMS.actor) ?? '',
    target: params.get(PARAMS.target) ?? '',
    since: params.get(PARAMS.since) ?? '',
    until: params.get(PARAMS.until) ?? '',
  }
  const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0)
  const apply = (next: AuditFilter, nextPage = 0) => {
    const search = new URLSearchParams()
    for (const key of Object.keys(PARAMS) as (keyof AuditFilter)[]) {
      const value = next[key].trim()
      if (value !== '') search.set(PARAMS[key], value)
    }
    if (nextPage > 0) search.set('page', String(nextPage))
    setParams(search)
  }
  const query: AuditFilter = { ...form, since: instant(form.since), until: instant(form.until) }
  return { form, query, page, apply }
}

/** The audit log, filtered and paged, and a check of its hash chain. */
export function AuditPage() {
  const { t } = useTranslation()
  const view = useView()
  const events = useAuditEvents(view.query, view.page)

  return (
    <>
      <PageHeading title={t('admin.audit.title')}>{t('admin.audit.intro')}</PageHeading>
      <VerifyChain />
      {/* Keyed by the address: going to another view starts the form from it. */}
      <Filters
        key={JSON.stringify(view.form)}
        initial={view.form}
        rejected={events.isError ? fieldsOf(events.error) : []}
        onApply={view.apply}
      />
      {events.isPending ? <p role="status">{t('admin.audit.loading')}</p> : null}
      {events.isError ? (
        <p role="alert">{t(`admin.audit.failed.${reasonOf(events.error)}`)}</p>
      ) : null}
      {events.data && events.data.items.length === 0 ? <p>{t('admin.audit.empty')}</p> : null}
      {events.data && events.data.items.length > 0 ? (
        <>
          <Events events={events.data.items} />
          <Pager
            label={t('admin.audit.pagination')}
            page={view.page}
            size={PAGE_SIZE}
            total={events.data.total}
            onPage={(page) => view.apply(view.form, page)}
          />
        </>
      ) : null}
    </>
  )
}

function Filters({
  initial,
  rejected,
  onApply,
}: {
  initial: AuditFilter
  rejected: string[]
  onApply: (filter: AuditFilter) => void
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState(initial)
  const id = useId()
  const ids = (name: string) => `${id}-${name}`
  const set = (key: keyof AuditFilter) => (event: { target: { value: string } }) =>
    setFilter((current) => ({ ...current, [key]: event.target.value }))
  const invalid = (name: string) => rejected.includes(name) || undefined

  return (
    <form
      aria-label={t('admin.audit.filters')}
      className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault()
        onApply(filter)
      }}
    >
      <div>
        <label htmlFor={ids('action')} className="font-medium">
          {t('admin.audit.action')}
        </label>
        <input
          id={ids('action')}
          maxLength={64}
          spellCheck={false}
          value={filter.action}
          aria-describedby={ids('action-hint')}
          aria-invalid={invalid('action')}
          onChange={set('action')}
          className={`${field} font-mono text-sm`}
        />
        <p id={ids('action-hint')} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t('admin.audit.actionHint')}
        </p>
      </div>
      <div>
        <label htmlFor={ids('outcome')} className="font-medium">
          {t('admin.audit.outcome')}
        </label>
        <select
          id={ids('outcome')}
          value={filter.outcome}
          onChange={set('outcome')}
          className={field}
        >
          <option value="">{t('admin.audit.anyOutcome')}</option>
          {OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {t(`admin.audit.outcomes.${outcome}`)}
            </option>
          ))}
        </select>
      </div>
      {(['actor', 'target'] as const).map((key) => (
        <div key={key}>
          <label htmlFor={ids(key)} className="font-medium">
            {t(`admin.audit.${key}`)}
          </label>
          <input
            id={ids(key)}
            spellCheck={false}
            value={filter[key]}
            aria-invalid={invalid(key === 'actor' ? 'actor_id' : 'target_id')}
            onChange={set(key)}
            className={`${field} font-mono text-sm`}
          />
        </div>
      ))}
      {(['since', 'until'] as const).map((key) => (
        <div key={key}>
          <label htmlFor={ids(key)} className="font-medium">
            {t(`admin.audit.${key}`)}
          </label>
          <input
            id={ids(key)}
            type="datetime-local"
            value={filter[key]}
            aria-invalid={invalid(key)}
            onChange={set(key)}
            className={field}
          />
        </div>
      ))}
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
        <button type="submit" className={primaryButton}>
          {t('admin.audit.apply')}
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() =>
            onApply({ action: '', outcome: '', actor: '', target: '', since: '', until: '' })
          }
        >
          {t('admin.audit.clear')}
        </button>
      </div>
    </form>
  )
}

function Who({ event }: { event: AuditEvent }) {
  const { t } = useTranslation()
  const kind = KINDS.find((k) => k === event.actor_kind)
  const label = kind ? t(`admin.audit.kinds.${kind}`) : event.actor_kind
  if (event.actor_kind === 'user' && event.actor_id) {
    return (
      <>
        {label}{' '}
        <Link to={`/admin/users/${event.actor_id}`} className="font-mono text-sm underline">
          {event.actor_id.slice(0, 8)}
        </Link>
      </>
    )
  }
  return <>{label}</>
}

function On({ event }: { event: AuditEvent }) {
  if (!event.target_id) return <>{event.target_kind ?? ''}</>
  const short = <span className="font-mono text-sm">{event.target_id.slice(0, 8)}</span>
  const to =
    event.target_kind === 'file'
      ? `/admin/files/${event.target_id}`
      : event.target_kind === 'user'
        ? `/admin/users/${event.target_id}`
        : null
  return (
    <>
      {event.target_kind}{' '}
      {to ? (
        <Link to={to} className="underline">
          {short}
        </Link>
      ) : (
        short
      )}
    </>
  )
}

function Events({ events }: { events: AuditEvent[] }) {
  const { t, i18n } = useTranslation()
  const th = 'py-2 pr-4 font-medium'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">{t('admin.audit.tableCaption')}</caption>
        <thead className="border-b border-slate-200 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <tr>
            <th scope="col" className={th}>
              {t('admin.audit.when')}
            </th>
            <th scope="col" className={th}>
              {t('admin.audit.what')}
            </th>
            <th scope="col" className={th}>
              {t('admin.audit.result')}
            </th>
            <th scope="col" className={th}>
              {t('admin.audit.who')}
            </th>
            <th scope="col" className={th}>
              {t('admin.audit.on')}
            </th>
            <th scope="col" className={th}>
              {t('admin.audit.from')}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t('admin.audit.details')}
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const outcome = OUTCOMES.find((o) => o === event.outcome)
            return (
              <tr
                key={event.id}
                className="border-b border-slate-100 align-top dark:border-slate-900"
              >
                <td className="py-3 pr-4 whitespace-nowrap">
                  {formatDateTime(event.occurred_at, i18n.language)}
                </td>
                <th scope="row" className="py-3 pr-4 font-mono text-sm font-medium">
                  {event.action}
                </th>
                <td
                  className={`py-3 pr-4 ${event.outcome === 'ok' ? '' : 'font-medium text-rose-700 dark:text-rose-300'}`}
                >
                  {outcome ? t(`admin.audit.outcomes.${outcome}`) : event.outcome}
                </td>
                <td className="py-3 pr-4">
                  <Who event={event} />
                </td>
                <td className="py-3 pr-4">
                  <On event={event} />
                </td>
                <td className="py-3 pr-4 font-mono text-sm">{event.client_ip ?? ''}</td>
                <td className="py-3">
                  <details>
                    <summary
                      className="cursor-pointer text-sm underline"
                      aria-label={t('admin.audit.showDetails', { id: event.id })}
                    >
                      {t('admin.audit.details')}
                    </summary>
                    {/* As text: what the API recorded, never rendered as markup. */}
                    <pre className="mt-2 max-w-md overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                    {event.request_id ? (
                      <p className="mt-1 font-mono text-xs">
                        {t('admin.audit.request', { id: event.request_id })}
                      </p>
                    ) : null}
                  </details>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function VerifyChain() {
  const { t } = useTranslation()
  const verify = useVerifyChain()
  const result = verify.data
  return (
    <div className="mb-6">
      <button
        type="button"
        className={secondaryButton}
        disabled={verify.isPending}
        onClick={() => verify.mutate()}
      >
        {verify.isPending ? t('admin.audit.verifying') : t('admin.audit.verify')}
      </button>
      <div aria-live="polite" className="mt-2">
        {verify.isError ? (
          <p className="font-medium text-rose-700 dark:text-rose-300">
            {t('admin.audit.verifyFailed')}
          </p>
        ) : null}
        {result?.ok ? (
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            {t('admin.audit.verified', { count: result.events })}
          </p>
        ) : null}
        {result && !result.ok ? (
          <div className="font-medium text-rose-700 dark:text-rose-300">
            <p>
              {t('admin.audit.broken', {
                id: result.first_broken_id ?? '?',
                head: result.head_id ?? '–',
              })}
            </p>
            {result.reason ? (
              <p>{t('admin.audit.brokenReason', { reason: result.reason })}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
