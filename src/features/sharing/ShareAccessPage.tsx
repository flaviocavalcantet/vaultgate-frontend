import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'

import { formatDateTime } from '@/components/format'
import { FrontDoor } from '@/components/FrontDoor'
import { PageHeading } from '@/components/PageHeading'
import { primaryButton, secondaryButton } from '@/components/styles'

import { type Failure, reasonOf } from './failures'
import { tokenFromHash } from './link'
import type { Grant, ShareAccess } from './types'
import { useSendCode, useShareAccess, useShareDownload, useVerifyCode } from './useShareAccess'

const CODE = /^[0-9]{6}$/

/**
 * The page a share link opens, for a recipient without an account. The token comes
 * from the link's fragment and is removed from the address at once; it, and the grant
 * the code buys, stay in memory only.
 */
export function ShareAccessPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => tokenFromHash(location.hash))
  const access = useShareAccess(token)

  useEffect(() => {
    if (location.hash) void navigate({ pathname: location.pathname, hash: '' }, { replace: true })
  }, [location.hash, location.pathname, navigate])

  let body: React.ReactNode
  if (token === null) body = <p role="alert">{t('access.noToken')}</p>
  else if (access.isPending) body = <p role="status">{t('access.loading')}</p>
  else if (access.isError) body = <p role="alert">{t(`access.failed.${reasonOf(access.error)}`)}</p>
  else body = <Recipient token={token} access={access.data} />

  return (
    <FrontDoor>
      <PageHeading door title={t('access.title')} />
      {body}
    </FrontDoor>
  )
}

function Recipient({ token, access }: { token: string; access: ShareAccess }) {
  const { t, i18n } = useTranslation()
  const details = (
    <p className="mb-4">
      {t('access.details', {
        hint: access.recipient_hint,
        expires: formatDateTime(access.expires_at, i18n.language),
        count: access.downloads_left,
      })}
    </p>
  )
  if (access.recipient_kind === 'internal') {
    return (
      <>
        {details}
        <p className="mb-4">{t('access.internal')}</p>
        <Link to="/shared" className={primaryButton}>
          {t('access.openShared')}
        </Link>
      </>
    )
  }
  return (
    <>
      {details}
      <External token={token} />
    </>
  )
}

type Step =
  { name: 'start' } | { name: 'code'; sentTo: string | null } | { name: 'ready'; grant: Grant }

/** An outside recipient's steps: a code to their address, the code, then downloads. */
function External({ token }: { token: string }) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>({ name: 'start' })
  const [problem, setProblem] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const sendCode = useSendCode(token)
  const verify = useVerifyCode(token)
  const download = useShareDownload(token)

  const fail = (group: 'failed' | 'codeFailed', reason: Failure) =>
    setProblem(t(`access.${group}.${reason}`))

  const onSend = () => {
    setProblem(null)
    sendCode.mutate(undefined, {
      onSuccess: ({ sentTo }) => setStep({ name: 'code', sentTo }),
      onError: (error) => fail('codeFailed', reasonOf(error)),
    })
  }

  const onVerify = (code: string) => {
    setProblem(null)
    verify.mutate(code, {
      onSuccess: (grant) => setStep({ name: 'ready', grant }),
      onError: (error) => fail('codeFailed', reasonOf(error)),
    })
  }

  const onDownload = (grant: Grant) => {
    setProblem(null)
    setStarted(false)
    download.mutate(grant.grant, {
      onSuccess: () => setStarted(true),
      onError: (error) => {
        const reason = reasonOf(error)
        if (reason === 'denied') {
          // The grant ended (it lasts minutes): a new code gets a new one.
          setStep({ name: 'start' })
          setProblem(t('access.expired'))
        } else {
          fail('failed', reason)
        }
      },
    })
  }

  return (
    <>
      <div aria-live="polite" className="mb-4">
        {problem ? <p className="font-medium text-seal">{problem}</p> : null}
        {step.name === 'code' ? (
          <p>{step.sentTo ? t('access.sent', { to: step.sentTo }) : t('access.sentNoAddress')}</p>
        ) : null}
        {step.name === 'ready' ? <p className="font-medium">{t('access.verified')}</p> : null}
        {started ? <p className="font-medium">{t('access.started')}</p> : null}
      </div>

      {step.name === 'start' ? (
        <>
          <p className="mb-4">{t('access.prove')}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={primaryButton}
              disabled={sendCode.isPending}
              onClick={onSend}
            >
              {sendCode.isPending ? t('access.sending') : t('access.sendCode')}
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setStep({ name: 'code', sentTo: null })}
            >
              {t('access.haveCode')}
            </button>
          </div>
        </>
      ) : null}

      {step.name === 'code' ? (
        <CodeForm
          checking={verify.isPending}
          sending={sendCode.isPending}
          onCheck={onVerify}
          onNewCode={onSend}
          onInvalid={() => setProblem(t('access.codeFormat'))}
        />
      ) : null}

      {step.name === 'ready' ? (
        <button
          type="button"
          className={primaryButton}
          disabled={download.isPending}
          onClick={() => onDownload(step.grant)}
        >
          {t('access.download')}
        </button>
      ) : null}
    </>
  )
}

function CodeForm({
  checking,
  sending,
  onCheck,
  onNewCode,
  onInvalid,
}: {
  checking: boolean
  sending: boolean
  onCheck: (code: string) => void
  onNewCode: () => void
  onInvalid: () => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const id = useId()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [])

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const digits = code.replace(/\s/g, '')
    if (CODE.test(digits)) onCheck(digits)
    else onInvalid()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor={id} className="font-medium">
          {t('access.code')}
        </label>
        <input
          ref={input}
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          aria-describedby={`${id}-hint`}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="mt-1 block w-48 rounded border border-control bg-surface px-3 py-2 font-mono text-2xl tracking-[0.3em]"
        />
        <p id={`${id}-hint`} className="mt-1 text-sm text-graphite">
          {t('access.codeHint')}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={checking}>
          {checking ? t('access.checking') : t('access.check')}
        </button>
        <button type="button" className={secondaryButton} disabled={sending} onClick={onNewCode}>
          {sending ? t('access.sending') : t('access.newCode')}
        </button>
      </div>
    </form>
  )
}
