import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { formatDateTime } from '@/components/format'
import { PageHeading } from '@/components/PageHeading'
import { Seal, type SealTone } from '@/components/Seal'
import { primaryButton, secondaryButton } from '@/components/styles'

import { reasonOf } from './failures'
import {
  type NewShare,
  useCreateShare,
  useRevokeShare,
  useShares,
  useSharedTarget,
} from './useShares'
import type { ShareCreate, ShareOut, ShareTarget } from './types'

/** A link's state, sealed: only an active link certifies anything. */
const SEALS = {
  active: 'certified',
  used: 'neutral',
  expired: 'neutral',
  revoked: 'blocked',
} as const satisfies Record<ShareOut['state'], SealTone>

const field = 'mt-1 block w-full max-w-md rounded border border-control bg-surface px-3 py-2'

/** A number field's value for the API: empty means the API's default. */
function optionalCount(value: string): number | null {
  const number = Number(value)
  return value.trim() === '' || !Number.isFinite(number) ? null : number
}

/** An owner's sharing of one file: a new link, and the file's links with their state. */
export function ShareFilePage() {
  const { fileId = '' } = useParams()
  return <SharePage target={{ kind: 'file', id: fileId }} />
}

/**
 * An owner's sharing of one folder, with everything in it now and later (vaultgate ADR
 * 0020): a new link, and the folder's links with their state.
 */
export function ShareFolderPage() {
  const { folderId = '' } = useParams()
  return <SharePage target={{ kind: 'folder', id: folderId }} />
}

function SharePage({ target }: { target: ShareTarget }) {
  const { t } = useTranslation()
  const shared = useSharedTarget(target)
  const loadingTitle =
    target.kind === 'folder' ? t('sharing.titleFolderLoading') : t('sharing.titleLoading')

  if (shared.isPending) {
    return (
      <>
        <PageHeading title={loadingTitle} />
        <p role="status">{t('sharing.loading')}</p>
      </>
    )
  }
  if (shared.isError) {
    const reason = reasonOf(shared.error) === 'notFound' ? 'notFound' : 'unknown'
    return (
      <>
        <PageHeading title={loadingTitle} />
        <p role="alert" className="mb-4">
          {t(`sharing.failed.${reason}${target.kind === 'folder' ? 'Folder' : ''}`)}
        </p>
        <Link to="/files" className="underline">
          {t('sharing.back')}
        </Link>
      </>
    )
  }
  const { name, shareable, folderId } = shared.data
  return (
    <>
      <PageHeading
        title={
          target.kind === 'folder'
            ? t('sharing.titleFolder', { name })
            : t('sharing.title', { name })
        }
      >
        {t('sharing.intro')}
      </PageHeading>
      {target.kind === 'folder' ? (
        <p className="mb-4 max-w-prose">{t('sharing.folderNote')}</p>
      ) : null}
      <p className="mb-6">
        <Link to={folderId ? `/files/in/${folderId}` : '/files'} className="underline">
          {folderId
            ? t('sharing.backTo', {
                name: target.kind === 'folder' ? name : t('sharing.itsFolder'),
              })
            : t('sharing.back')}
        </Link>
      </p>
      {shareable ? (
        <NewLink target={target} />
      ) : (
        <p className="mb-6 font-medium">{t('sharing.notShareable')}</p>
      )}
      <Links target={target} name={name} />
    </>
  )
}

function NewLink({ target }: { target: ShareTarget }) {
  const { t } = useTranslation()
  const create = useCreateShare(target)
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<'external' | 'internal'>('external')
  const [days, setDays] = useState('')
  const [downloads, setDownloads] = useState('')
  const ids = { email: useId(), days: useId(), downloads: useId(), hint: useId() }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const body: ShareCreate = {
      recipient_email: email.trim(),
      recipient_kind: kind,
      expires_in_days: optionalCount(days),
      max_downloads: optionalCount(downloads),
    }
    create.mutate(body, {
      onSuccess: () => {
        setEmail('')
        setDays('')
        setDownloads('')
      },
    })
  }

  return (
    <section aria-labelledby={`${ids.email}-heading`} className="mb-10">
      <h2 id={`${ids.email}-heading`} className="mb-3 text-xl font-semibold">
        {t('sharing.create')}
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor={ids.email} className="font-medium">
            {t('sharing.email')}
          </label>
          <input
            id={ids.email}
            type="email"
            required
            maxLength={320}
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={field}
          />
        </div>
        <fieldset>
          <legend className="font-medium">{t('sharing.kind')}</legend>
          {(['external', 'internal'] as const).map((value) => (
            <label key={value} className="mt-2 flex items-start gap-2">
              <input
                type="radio"
                name="recipient-kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="mt-1"
              />
              <span>
                {t(`sharing.${value}`)}
                <span className="block text-sm text-graphite">{t(`sharing.${value}Hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-6">
          <div>
            <label htmlFor={ids.days} className="font-medium">
              {t('sharing.days')}
            </label>
            <input
              id={ids.days}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              aria-describedby={ids.hint}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className={`${field} w-32`}
            />
          </div>
          <div>
            <label htmlFor={ids.downloads} className="font-medium">
              {t('sharing.downloads')}
            </label>
            <input
              id={ids.downloads}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              aria-describedby={ids.hint}
              value={downloads}
              onChange={(event) => setDownloads(event.target.value)}
              className={`${field} w-32`}
            />
          </div>
        </div>
        <p id={ids.hint} className="text-sm text-graphite">
          {t('sharing.defaultHint')}
        </p>
        <button type="submit" className={primaryButton} disabled={create.isPending}>
          {create.isPending ? t('sharing.creating') : t('sharing.submit')}
        </button>
      </form>
      <div aria-live="polite" className="mt-4">
        {create.isError ? (
          <p className="font-medium text-seal">
            {t(`sharing.createFailed.${reasonOf(create.error)}`)}
          </p>
        ) : null}
        {create.data ? <CreatedLink created={create.data} /> : null}
      </div>
    </section>
  )
}

/** The new link, shown once, with a way to copy it. */
function CreatedLink({ created }: { created: NewShare }) {
  const { t } = useTranslation()
  const id = useId()
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const email = created.share.recipient_email

  const onCopy = () => {
    navigator.clipboard.writeText(created.link).then(
      () => setCopy('copied'),
      () => setCopy('failed'),
    )
  }

  return (
    <div className="rounded-lg border border-accent bg-accent-soft p-4">
      <label htmlFor={id} className="font-medium">
        {t('sharing.created', { email })}
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id={id}
          readOnly
          value={created.link}
          onFocus={(event) => event.target.select()}
          className={`${field} mt-0 max-w-xl font-mono text-sm`}
        />
        <button type="button" className={secondaryButton} onClick={onCopy}>
          {t('sharing.copy')}
        </button>
      </div>
      <p className="mt-2 text-sm">{t('sharing.createdHint', { email })}</p>
      {copy === 'idle' ? null : (
        <p className="mt-2 text-sm font-medium">
          {copy === 'copied' ? t('sharing.copied') : t('sharing.copyFailed')}
        </p>
      )}
    </div>
  )
}

function Links({ target, name }: { target: ShareTarget; name: string }) {
  const { t, i18n } = useTranslation()
  const shares = useShares(target)
  const revoke = useRevokeShare(target)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const headingId = useId()

  const onRevoke = (share: ShareOut) => {
    setNotice(null)
    revoke.mutate(share.id, {
      onSuccess: () =>
        setNotice({ kind: 'ok', text: t('sharing.revoked', { email: share.recipient_email }) }),
      onError: () =>
        setNotice({
          kind: 'error',
          text: t('sharing.revokeFailed', { email: share.recipient_email }),
        }),
    })
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-xl font-semibold">
        {t('sharing.list')}
      </h2>
      <div aria-live="polite">
        {notice ? (
          <p
            className={`mb-4 font-medium ${notice.kind === 'error' ? 'text-seal' : 'text-accent'}`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>
      {shares.isPending ? <p role="status">{t('sharing.listLoading')}</p> : null}
      {shares.isError ? <p role="alert">{t('sharing.listFailed')}</p> : null}
      {shares.data && shares.data.length === 0 ? <p>{t('sharing.listEmpty')}</p> : null}
      {shares.data && shares.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{t('sharing.listCaption', { name })}</caption>
            <thead className="border-b border-rule text-sm text-graphite">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('sharing.recipient')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('sharing.who')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('sharing.state')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('sharing.expires')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('sharing.used')}
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">{t('sharing.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shares.data.map((share) => (
                <tr key={share.id} className="border-b border-rule">
                  <th scope="row" className="max-w-xs truncate py-3 pr-4 font-medium">
                    {share.recipient_email}
                  </th>
                  <td className="py-3 pr-4">
                    {share.recipient_kind === 'internal'
                      ? t('sharing.whoInternal')
                      : t('sharing.whoExternal')}
                  </td>
                  <td className="py-3 pr-4">
                    <Seal tone={SEALS[share.state]} label={t(`sharing.states.${share.state}`)} />
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatDateTime(share.expires_at, i18n.language)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {t('sharing.usedCount', {
                      downloads: share.downloads,
                      max: share.max_downloads,
                    })}
                  </td>
                  <td className="py-3 text-right">
                    {share.state === 'active' ? (
                      <button
                        type="button"
                        className={secondaryButton}
                        disabled={revoke.isPending && revoke.variables === share.id}
                        onClick={() => onRevoke(share)}
                        aria-label={t('sharing.revokeName', { email: share.recipient_email })}
                      >
                        {t('sharing.revoke')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
