import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { fieldsOf, reasonOf } from './failures'
import { bodyOf, draftOf, emptyDraft, type PolicyDraft, timeZones, weekday } from './policyDraft'
import { ACTIONS, type Policy } from './types'
import { useDeletePolicy, usePolicy, useSavePolicy } from './usePolicies'

const field =
  'mt-1 block w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 aria-invalid:border-rose-600 dark:border-slate-700 dark:bg-slate-950'
const hint = 'mt-1 text-sm text-slate-600 dark:text-slate-300'
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const

/** The list with the item added, or taken out if it was there. */
function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

/** A new policy (`/admin/policies/new`) or an existing one, to edit or delete. */
export function PolicyPage() {
  const { t } = useTranslation()
  const { policyId = 'new' } = useParams()
  const isNew = policyId === 'new'
  const policy = usePolicy(isNew ? '' : policyId)

  const back = (
    <p className="mb-6">
      <Link to="/admin/policies" className="underline">
        {t('admin.policy.back')}
      </Link>
    </p>
  )
  if (isNew) {
    return (
      <>
        <PageHeading title={t('admin.policy.newTitle')} />
        {back}
        <PolicyForm policy={null} />
      </>
    )
  }
  if (policy.isPending) {
    return (
      <>
        <PageHeading title={t('admin.policy.titleLoading')} />
        <p role="status">{t('admin.policy.loading')}</p>
      </>
    )
  }
  if (policy.isError) {
    return (
      <>
        <PageHeading title={t('admin.policy.titleLoading')} />
        <p role="alert" className="mb-4">
          {t(`admin.policy.failed.${reasonOf(policy.error)}`)}
        </p>
        {back}
      </>
    )
  }
  return (
    <>
      <PageHeading title={t('admin.policy.editTitle', { name: policy.data.name })} />
      {back}
      <PolicyForm policy={policy.data} />
      <DeletePolicy policy={policy.data} />
    </>
  )
}

function PolicyForm({ policy }: { policy: Policy | null }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const save = useSavePolicy(policy?.id ?? null)
  const [draft, setDraft] = useState<PolicyDraft>(() => (policy ? draftOf(policy) : emptyDraft))
  const [windowProblem, setWindowProblem] = useState(false)
  const justCreated = (location.state as { created?: boolean } | null)?.created === true
  const id = useId()
  const ids = (name: string) => `${id}-${name}`
  const zonesId = ids('zones')

  const rejected = new Set(save.isError ? fieldsOf(save.error) : [])
  const invalid = (...names: string[]) => names.some((name) => rejected.has(name)) || undefined
  const set = <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const oneTime = (draft.startTime === '') !== (draft.endTime === '')
    const sameTime = draft.startTime !== '' && draft.startTime === draft.endTime
    setWindowProblem(oneTime || sameTime)
    if (oneTime || sameTime) return
    save.mutate(bodyOf(draft), {
      onSuccess: (saved) => {
        if (!policy) {
          void navigate(`/admin/policies/${saved.id}`, { replace: true, state: { created: true } })
        }
      },
    })
  }

  let problem: string | null = null
  if (windowProblem) problem = t('admin.policy.invalidWindow')
  else if (save.isError) {
    problem = t(`admin.policy.saveFailed.${reasonOf(save.error)}`)
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
    <form onSubmit={onSubmit} className="mb-10 space-y-6" noValidate>
      <div>
        <label htmlFor={ids('name')} className="font-medium">
          {t('admin.policy.name')}
        </label>
        <input
          id={ids('name')}
          required
          maxLength={100}
          value={draft.name}
          aria-invalid={invalid('name')}
          onChange={(event) => set('name', event.target.value)}
          className={field}
        />
      </div>
      <div>
        <label htmlFor={ids('description')} className="font-medium">
          {t('admin.policy.description')}
        </label>
        <textarea
          id={ids('description')}
          maxLength={2000}
          rows={2}
          value={draft.description}
          aria-invalid={invalid('description')}
          onChange={(event) => set('description', event.target.value)}
          className={field}
        />
      </div>
      <fieldset>
        <legend className="font-medium">{t('admin.policy.effect')}</legend>
        {(['allow', 'deny'] as const).map((effect) => (
          <label key={effect} className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name={ids('effect')}
              checked={draft.effect === effect}
              onChange={() => set('effect', effect)}
            />
            {t(effect === 'allow' ? 'admin.policy.effectAllow' : 'admin.policy.effectDeny')}
          </label>
        ))}
      </fieldset>
      <fieldset aria-invalid={invalid('actions')}>
        <legend className="font-medium">{t('admin.policy.actions')}</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {ACTIONS.map((action) => (
            <label key={action} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.actions.includes(action)}
                onChange={() => set('actions', toggle(draft.actions, action))}
              />
              {t(`admin.actions.${action}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => set('enabled', event.target.checked)}
        />
        {t('admin.policy.enabled')}
      </label>

      <fieldset className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <legend className="text-lg font-semibold">{t('admin.policy.conditions')}</legend>
        <p className={hint}>{t('admin.policy.conditionsHint')}</p>
        {(
          [
            ['groups', 'groups', 'groupsHint'],
            ['networks', 'networks', 'networksHint'],
            ['excludedNetworks', 'excluded_networks', 'excludedNetworksHint'],
          ] as const
        ).map(([key, apiName, hintKey]) => (
          <div key={key}>
            <label htmlFor={ids(key)} className="font-medium">
              {t(`admin.policy.${key}`)}
            </label>
            <textarea
              id={ids(key)}
              rows={3}
              spellCheck={false}
              value={draft[key]}
              aria-describedby={ids(`${key}-hint`)}
              aria-invalid={invalid(apiName)}
              onChange={(event) => set(key, event.target.value)}
              className={`${field} font-mono text-sm`}
            />
            <p id={ids(`${key}-hint`)} className={hint}>
              {t(`admin.policy.${hintKey}`)}
            </p>
          </div>
        ))}
        <fieldset aria-invalid={invalid('days')}>
          <legend className="font-medium">{t('admin.policy.days')}</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {DAYS.map((day) => (
              <label key={day} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.days.includes(day)}
                  onChange={() => set('days', toggle(draft.days, day))}
                />
                {weekday(day, i18n.language)}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <div className="flex flex-wrap gap-6">
            {(['startTime', 'endTime'] as const).map((key) => (
              <div key={key}>
                <label htmlFor={ids(key)} className="font-medium">
                  {t(`admin.policy.${key}`)}
                </label>
                <input
                  id={ids(key)}
                  type="time"
                  value={draft[key]}
                  aria-describedby={ids('time-hint')}
                  aria-invalid={
                    windowProblem || invalid(key === 'startTime' ? 'start_time' : 'end_time')
                  }
                  onChange={(event) => set(key, event.target.value)}
                  className={`${field} w-36`}
                />
              </div>
            ))}
          </div>
          <p id={ids('time-hint')} className={hint}>
            {t('admin.policy.timeHint')}
          </p>
        </div>
        <div>
          <label htmlFor={ids('timezone')} className="font-medium">
            {t('admin.policy.timezone')}
          </label>
          <input
            id={ids('timezone')}
            list={zonesId}
            maxLength={64}
            spellCheck={false}
            value={draft.timezone}
            aria-describedby={ids('timezone-hint')}
            aria-invalid={invalid('timezone')}
            onChange={(event) => set('timezone', event.target.value)}
            className={`${field} max-w-xs`}
          />
          <datalist id={zonesId}>
            {timeZones().map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </datalist>
          <p id={ids('timezone-hint')} className={hint}>
            {t('admin.policy.timezoneHint')}
          </p>
        </div>
      </fieldset>

      <div aria-live="polite">
        {problem ? (
          <p className="mb-2 font-medium text-rose-700 dark:text-rose-300">{problem}</p>
        ) : null}
        {(save.isSuccess || justCreated) && !save.isError ? (
          <p className="mb-2 font-medium text-emerald-800 dark:text-emerald-300">
            {t('admin.policy.saved')}
          </p>
        ) : null}
      </div>
      <button type="submit" className={primaryButton} disabled={save.isPending}>
        {save.isPending
          ? t('admin.policy.saving')
          : t(policy ? 'admin.policy.save' : 'admin.policy.create')}
      </button>
    </form>
  )
}

function DeletePolicy({ policy }: { policy: Policy }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const remove = useDeletePolicy(policy.id)
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button type="button" className={secondaryButton} onClick={() => setConfirming(true)}>
        {t('admin.policy.delete')}
      </button>
    )
  }
  return (
    <div role="group" aria-label={t('admin.policy.delete')} className="space-y-3">
      <p className="font-medium">{t('admin.policy.deleteConfirm', { name: policy.name })}</p>
      <div aria-live="polite">
        {remove.isError ? (
          <p className="font-medium text-rose-700 dark:text-rose-300">
            {t('admin.policy.deleteFailed')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={primaryButton}
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => void navigate('/admin/policies', { replace: true }),
            })
          }
        >
          {remove.isPending ? t('admin.policy.deleting') : t('admin.policy.deleteYes')}
        </button>
        <button type="button" className={secondaryButton} onClick={() => setConfirming(false)}>
          {t('admin.policy.deleteNo')}
        </button>
      </div>
    </div>
  )
}
