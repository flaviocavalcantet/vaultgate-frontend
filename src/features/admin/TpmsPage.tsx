import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { ConfirmAction } from './ConfirmAction'
import { reasonOf } from './failures'
import { Pager } from './Pager'
import { EK_FINGERPRINT, NODE_NAME, type Tpm } from './types'
import { PAGE_SIZE, useRegisterTpm, useRevokeTpm, useTpms } from './useNodes'
import { useShowAll } from './useShowAll'

const field =
  'mt-1 block w-full rounded border border-control bg-surface px-3 py-2 font-mono text-sm aria-invalid:border-seal'
type Notice = { kind: 'ok' | 'error'; text: string }

/** TPMs registered, by endorsement key, to enroll one node each by attestation. */
export function TpmsPage() {
  const { t, i18n } = useTranslation()
  const view = useShowAll()
  const tpms = useTpms(view.all, view.page)
  const revoke = useRevokeTpm()
  const [notice, setNotice] = useState<Notice | null>(null)
  const showId = useId()
  const when = (iso: string) => formatDateTime(iso, i18n.language)

  const onRevoke = (tpm: Tpm, done: () => void) =>
    revoke.mutate(tpm.id, {
      onSuccess: () => setNotice({ kind: 'ok', text: t('admin.tpms.revoked', { name: tpm.name }) }),
      onError: () =>
        setNotice({ kind: 'error', text: t('admin.tpms.revokeFailed', { name: tpm.name }) }),
      onSettled: done,
    })

  return (
    <>
      <PageHeading title={t('admin.tpms.title')}>{t('admin.tpms.intro')}</PageHeading>
      <RegisterTpm />
      <div className="mb-4">
        <label htmlFor={showId} className="mr-2 font-medium">
          {t('admin.tpms.show')}
        </label>
        <select
          id={showId}
          value={view.all ? 'all' : 'usable'}
          onChange={(event) => view.set({ all: event.target.value === 'all' })}
          className="rounded border border-control bg-surface px-2 py-1.5"
        >
          <option value="usable">{t('admin.tpms.usable')}</option>
          <option value="all">{t('admin.tpms.all')}</option>
        </select>
      </div>
      <div aria-live="polite">
        {notice ? (
          <p className={`mb-4 font-medium ${notice.kind === 'error' ? 'text-seal' : ''}`}>
            {notice.text}
          </p>
        ) : null}
      </div>
      {tpms.isPending ? <p role="status">{t('admin.tpms.loading')}</p> : null}
      {tpms.isError ? (
        <div role="alert">
          <p className="mb-3">{t('admin.tpms.failed')}</p>
          <button type="button" className={secondaryButton} onClick={() => void tpms.refetch()}>
            {t('admin.tpms.retry')}
          </button>
        </div>
      ) : null}
      {tpms.data && tpms.data.items.length === 0 ? (
        <p>{t(view.all ? 'admin.tpms.emptyAll' : 'admin.tpms.empty')}</p>
      ) : null}
      {tpms.data && tpms.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('admin.tpms.tableCaption')}</caption>
              <thead className="border-b border-rule text-sm text-graphite">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.tpms.name')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.tpms.fingerprint')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.tpms.state')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('admin.tpms.expires')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">{t('admin.tpms.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tpms.data.items.map((tpm) => (
                  <tr key={tpm.id} className="border-b border-rule align-top">
                    <th scope="row" className="py-3 pr-4 font-mono text-sm font-medium">
                      {tpm.name}
                    </th>
                    <td className="max-w-xs py-3 pr-4 font-mono text-xs break-all">
                      {tpm.ek_fingerprint}
                    </td>
                    <td className="py-3 pr-4">
                      {t(`admin.tokens.states.${tpm.state}`)}
                      {tpm.used_at ? (
                        <span className="block text-sm">
                          {t('admin.tokens.usedAt', { when: when(tpm.used_at) })}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{when(tpm.expires_at)}</td>
                    <td className="py-3 text-right">
                      {tpm.state === 'usable' ? (
                        <ConfirmAction
                          label={t('admin.tpms.revoke')}
                          name={t('admin.tpms.revokeName', { name: tpm.name })}
                          question={t('admin.tpms.revokeConfirm', { name: tpm.name })}
                          yes={t('admin.tpms.revokeYes')}
                          no={t('admin.tpms.revokeNo')}
                          pending={revoke.isPending}
                          onConfirm={(done) => onRevoke(tpm, done)}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            label={t('admin.tpms.tableCaption')}
            page={view.page}
            size={PAGE_SIZE}
            total={tpms.data.total}
            onPage={(page) => view.set({ page })}
          />
        </>
      ) : null}
    </>
  )
}

function RegisterTpm() {
  const { t, i18n } = useTranslation()
  const register = useRegisterTpm()
  const [name, setName] = useState('')
  const [ek, setEk] = useState('')
  const [problems, setProblems] = useState({ name: false, ek: false })
  const [registered, setRegistered] = useState<Tpm | null>(null)
  const id = useId()
  const ids = (key: string) => `${id}-${key}`

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const body = { name: name.trim(), ek_fingerprint: ek.trim() }
    const found = {
      name: !NODE_NAME.test(body.name),
      ek: !EK_FINGERPRINT.test(body.ek_fingerprint),
    }
    setProblems(found)
    if (found.name || found.ek) return
    setRegistered(null)
    register.mutate(body, {
      onSuccess: (tpm) => {
        setRegistered(tpm)
        setName('')
        setEk('')
      },
    })
  }

  return (
    <section aria-labelledby={ids('heading')} className="mb-10">
      <h2 id={ids('heading')} className="mb-3 text-xl font-semibold">
        {t('admin.tpms.register')}
      </h2>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="max-w-xs">
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
            aria-invalid={problems.name || undefined}
            onChange={(event) => setName(event.target.value)}
            className={field}
          />
          <p id={ids('name-hint')} className="mt-1 text-sm text-graphite">
            {t('admin.nodeForm.nameHint')}
          </p>
        </div>
        <div className="max-w-xl">
          <label htmlFor={ids('ek')} className="font-medium">
            {t('admin.tpms.ek')}
          </label>
          <input
            id={ids('ek')}
            required
            autoComplete="off"
            spellCheck={false}
            value={ek}
            aria-describedby={ids('ek-hint')}
            aria-invalid={problems.ek || undefined}
            onChange={(event) => setEk(event.target.value)}
            className={field}
          />
          <p id={ids('ek-hint')} className="mt-1 text-sm text-graphite">
            {t('admin.tpms.ekHint')}
          </p>
        </div>
        <button type="submit" className={primaryButton} disabled={register.isPending}>
          {register.isPending ? t('admin.tpms.registering') : t('admin.tpms.submit')}
        </button>
      </form>
      <div aria-live="polite" className="mt-4 space-y-1">
        {problems.name ? (
          <p className="font-medium text-seal">{t('admin.nodeForm.nameInvalid')}</p>
        ) : null}
        {problems.ek ? <p className="font-medium text-seal">{t('admin.tpms.ekInvalid')}</p> : null}
        {register.isError ? (
          <p className="font-medium text-seal">
            {t(`admin.tpms.registerFailed.${reasonOf(register.error)}`)}
          </p>
        ) : null}
        {registered ? (
          <p className="font-medium text-accent">
            {t('admin.tpms.registered', {
              name: registered.name,
              when: formatDateTime(registered.expires_at, i18n.language),
            })}
          </p>
        ) : null}
      </div>
    </section>
  )
}
