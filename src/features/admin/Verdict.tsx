import { useTranslation } from 'react-i18next'

import type { AdminFile } from './types'

const TONES = {
  pending: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  clean: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  quarantined: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
  unscannable: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  none: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
} as const

/** A file's scan verdict as a badge. The text says it; colour only repeats it. */
export function Verdict({ file }: { file: AdminFile }) {
  const { t } = useTranslation()
  const verdict = file.scan?.verdict ?? 'none'
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${TONES[verdict]}`}>
      {t(`admin.verdicts.${verdict}`)}
    </span>
  )
}
