import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton } from '@/components/styles'

import { fieldsOf, reasonOf } from './failures'
import { lines } from './policyDraft'
import { type Action, ACTIONS, type EvaluateIn, type Evaluation } from './types'
import { useEvaluate } from './usePolicies'

const field =
  'mt-1 block w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 aria-invalid:border-rose-600 dark:border-slate-700 dark:bg-slate-950'
const hint = 'mt-1 text-sm text-slate-600 dark:text-slate-300'

/** The policies' dry run: how a request would be decided, and which policies matched. */
export function EvaluatePage() {
  const { t } = useTranslation()
  const evaluate = useEvaluate()
  const [action, setAction] = useState<Action>('download')
  const [subject, setSubject] = useState<'groups' | 'user'>('groups')
  const [groups, setGroups] = useState('')
  const [userId, setUserId] = useState('')
  const [clientIp, setClientIp] = useState('')
  const [at, setAt] = useState('')
  const id = useId()
  const ids = (name: string) => `${id}-${name}`

  const rejected = new Set(evaluate.isError ? fieldsOf(evaluate.error) : [])
  const invalid = (name: string) => rejected.has(name) || undefined

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const body: EvaluateIn = {
      action,
      client_ip: clientIp.trim(),
      // A local date and time from the field, sent as an instant.
      at: at === '' ? null : new Date(at).toISOString(),
      ...(subject === 'groups' ? { groups: lines(groups) } : { user_id: userId.trim() }),
    }
    evaluate.mutate(body)
  }

  let problem: string | null = null
  if (evaluate.isError) {
    problem = t(`admin.evaluate.failed.${reasonOf(evaluate.error)}`)
    if (rejected.size > 0) {
      const names = [...rejected].map((name) =>
        t(`admin.policy.fieldNames.${name}` as 'admin.policy.fieldNames.name', {
          defaultValue: name,
        }),
      )
      problem = `${problem} ${t('admin.policy.invalidFields', { fields: names.join(', ') })}`
    }
  }

  return (
    <>
      <PageHeading title={t('admin.evaluate.title')}>{t('admin.evaluate.intro')}</PageHeading>
      <form onSubmit={onSubmit} noValidate className="mb-8 space-y-5">
        <div>
          <label htmlFor={ids('action')} className="font-medium">
            {t('admin.evaluate.action')}
          </label>
          <select
            id={ids('action')}
            value={action}
            onChange={(event) => setAction(event.target.value as Action)}
            className={`${field} max-w-xs`}
          >
            {ACTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`admin.actions.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="font-medium">{t('admin.evaluate.subject')}</legend>
          {(['groups', 'user'] as const).map((value) => (
            <label key={value} className="mt-2 flex items-center gap-2">
              <input
                type="radio"
                name={ids('subject')}
                checked={subject === value}
                onChange={() => setSubject(value)}
              />
              {t(value === 'groups' ? 'admin.evaluate.byGroups' : 'admin.evaluate.byUser')}
            </label>
          ))}
        </fieldset>
        {subject === 'groups' ? (
          <div>
            <label htmlFor={ids('groups')} className="font-medium">
              {t('admin.evaluate.groups')}
            </label>
            <textarea
              id={ids('groups')}
              rows={3}
              spellCheck={false}
              value={groups}
              aria-describedby={ids('groups-hint')}
              aria-invalid={invalid('groups')}
              onChange={(event) => setGroups(event.target.value)}
              className={`${field} font-mono text-sm`}
            />
            <p id={ids('groups-hint')} className={hint}>
              {t('admin.evaluate.groupsHint')}
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor={ids('user')} className="font-medium">
              {t('admin.evaluate.userId')}
            </label>
            <input
              id={ids('user')}
              spellCheck={false}
              value={userId}
              aria-invalid={invalid('user_id')}
              onChange={(event) => setUserId(event.target.value)}
              className={`${field} font-mono text-sm`}
            />
          </div>
        )}
        <div>
          <label htmlFor={ids('ip')} className="font-medium">
            {t('admin.evaluate.clientIp')}
          </label>
          <input
            id={ids('ip')}
            required
            spellCheck={false}
            value={clientIp}
            aria-invalid={invalid('client_ip')}
            onChange={(event) => setClientIp(event.target.value)}
            className={`${field} max-w-xs font-mono text-sm`}
          />
        </div>
        <div>
          <label htmlFor={ids('at')} className="font-medium">
            {t('admin.evaluate.at')}
          </label>
          <input
            id={ids('at')}
            type="datetime-local"
            value={at}
            aria-describedby={ids('at-hint')}
            aria-invalid={invalid('at')}
            onChange={(event) => setAt(event.target.value)}
            className={`${field} max-w-xs`}
          />
          <p id={ids('at-hint')} className={hint}>
            {t('admin.evaluate.atHint')}
          </p>
        </div>
        <button type="submit" className={primaryButton} disabled={evaluate.isPending}>
          {evaluate.isPending ? t('admin.evaluate.checking') : t('admin.evaluate.submit')}
        </button>
      </form>
      <div aria-live="polite">
        {problem ? <p className="font-medium text-rose-700 dark:text-rose-300">{problem}</p> : null}
        {evaluate.data ? <Result evaluation={evaluate.data} /> : null}
      </div>
    </>
  )
}

function Result({ evaluation }: { evaluation: Evaluation }) {
  const { t, i18n } = useTranslation()
  const names = (list: string[]) => (list.length > 0 ? list.join(', ') : t('admin.evaluate.none'))
  return (
    <section
      aria-labelledby="evaluation"
      className="rounded border border-slate-200 p-4 dark:border-slate-800"
    >
      <h2 id="evaluation" className="mb-2 text-lg font-semibold">
        {t('admin.evaluate.result')}:{' '}
        <span
          className={
            evaluation.allowed
              ? 'text-emerald-800 dark:text-emerald-300'
              : 'text-rose-700 dark:text-rose-300'
          }
        >
          {evaluation.allowed ? t('admin.evaluate.allowed') : t('admin.evaluate.denied')}
        </span>
      </h2>
      <p className="mb-3">{t(`admin.evaluate.reasons.${evaluation.reason}`)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
        <dt className="font-medium">{t('admin.evaluate.matchedAllow')}</dt>
        <dd>{names(evaluation.allow)}</dd>
        <dt className="font-medium">{t('admin.evaluate.matchedDeny')}</dt>
        <dd>{names(evaluation.deny)}</dd>
        <dt className="font-medium">{t('admin.evaluate.usedGroups')}</dt>
        <dd>{names(evaluation.groups)}</dd>
        <dt className="font-medium">{t('admin.evaluate.usedAddress')}</dt>
        <dd className="font-mono text-sm">{evaluation.client_ip}</dd>
        <dt className="font-medium">{t('admin.evaluate.usedAt')}</dt>
        <dd>{formatDateTime(evaluation.at, i18n.language)}</dd>
      </dl>
    </section>
  )
}
