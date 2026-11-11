import { useTranslation } from 'react-i18next'

import type { FileOut } from './types'

type Tone = 'neutral' | 'busy' | 'good' | 'bad'

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  busy: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  good: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  bad: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
}

function badge(tone: Tone, label: string) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${TONES[tone]}`}>
      {label}
    </span>
  )
}

/**
 * Where a file stands: its upload, then its scan. The text says it all; colour only
 * repeats it. Findings are shown by kind and count, never their content (the API
 * keeps no more than that).
 */
export function FileState({ file }: { file: FileOut }) {
  const { t } = useTranslation()

  if (file.status === 'pending') return badge('neutral', t('files.state.pending'))
  if (file.status === 'uploading') return badge('busy', t('files.state.uploading'))
  if (file.status !== 'uploaded') return badge('bad', t('files.state.failed'))

  const scan = file.scan
  if (!scan || scan.verdict === 'pending') return badge('busy', t('files.state.scanning'))
  if (scan.verdict === 'clean') return badge('good', t('files.state.clean'))

  const released = scan.releases.some((release) => release.purpose === 'download')
  const total = scan.findings.reduce((sum, finding) => sum + finding.count, 0)
  const kinds = scan.findings.map((finding) => finding.kind).join(', ')
  return (
    <div className="space-y-1">
      {badge(
        released ? 'neutral' : 'bad',
        t(scan.verdict === 'quarantined' ? 'files.state.quarantined' : 'files.state.unscannable'),
      )}
      {total > 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('files.found', { count: total, kinds })}
        </p>
      ) : null}
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {released ? t('files.state.released') : t('files.blocked')}
      </p>
    </div>
  )
}
