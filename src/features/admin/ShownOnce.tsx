import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { secondaryButton } from '@/components/styles'

/**
 * A secret the API returns once (a one-time code, an enrollment token): in a read-only
 * field to select, with a copy button. It lives in this component's memory only.
 */
export function ShownOnce({
  intro,
  label,
  value,
  hint,
}: {
  intro: string
  label: string
  value: string
  hint: string
}) {
  const { t } = useTranslation()
  const id = useId()
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <div className="rounded border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
      <p className="mb-2 font-medium">{intro}</p>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          id={id}
          readOnly
          value={value}
          onFocus={(event) => event.target.select()}
          className="block w-full max-w-xl rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          className={secondaryButton}
          aria-label={t('admin.shownOnce.copyName', { label })}
          onClick={() =>
            navigator.clipboard.writeText(value).then(
              () => setCopy('copied'),
              () => setCopy('failed'),
            )
          }
        >
          {t('admin.shownOnce.copy')}
        </button>
      </div>
      <p className="mt-2 text-sm">{hint}</p>
      {copy === 'idle' ? null : (
        <p className="mt-2 text-sm font-medium">
          {copy === 'copied' ? t('admin.shownOnce.copied') : t('admin.shownOnce.copyFailed')}
        </p>
      )}
    </div>
  )
}
