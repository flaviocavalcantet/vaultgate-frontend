import { useTranslation } from 'react-i18next'

import { Seal } from '@/components/Seal'

import type { FileOut } from './types'

/**
 * Where a file stands: its upload, then its scan. The text says it all; colour only
 * repeats it. Findings are shown by kind and count, never their content (the API
 * keeps no more than that).
 */
export function FileState({ file }: { file: FileOut }) {
  const { t } = useTranslation()

  if (file.status === 'pending') return <Seal tone="pending" label={t('files.state.pending')} />
  if (file.status === 'uploading') return <Seal tone="pending" label={t('files.state.uploading')} />
  if (file.status !== 'uploaded') return <Seal tone="warning" label={t('files.state.failed')} />

  const scan = file.scan
  if (!scan || scan.verdict === 'pending')
    return <Seal tone="pending" label={t('files.state.scanning')} />
  if (scan.verdict === 'clean') return <Seal tone="certified" label={t('files.state.clean')} />

  const released = scan.releases.some((release) => release.purpose === 'download')
  const total = scan.findings.reduce((sum, finding) => sum + finding.count, 0)
  const kinds = scan.findings.map((finding) => finding.kind).join(', ')
  return (
    <div className="space-y-1">
      <Seal
        // Released: the scan's verdict stands, but it no longer blocks the owner.
        tone={released ? 'neutral' : scan.verdict === 'quarantined' ? 'blocked' : 'warning'}
        label={t(
          scan.verdict === 'quarantined' ? 'files.state.quarantined' : 'files.state.unscannable',
        )}
      />
      {total > 0 ? (
        <p className="text-sm text-graphite">{t('files.found', { count: total, kinds })}</p>
      ) : null}
      <p className="text-sm text-graphite">
        {released ? t('files.state.released') : t('files.blocked')}
      </p>
    </div>
  )
}
