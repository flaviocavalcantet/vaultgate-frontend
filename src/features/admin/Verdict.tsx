import { useTranslation } from 'react-i18next'

import { Seal, type SealTone } from '@/components/Seal'

import type { AdminFile } from './types'

const TONES = {
  pending: 'pending',
  clean: 'certified',
  quarantined: 'blocked',
  unscannable: 'warning',
  none: 'neutral',
} as const satisfies Record<string, SealTone>

/** A file's scan verdict, sealed. The word says it; the mark and colour repeat it. */
export function Verdict({ file }: { file: AdminFile }) {
  const { t } = useTranslation()
  const verdict = file.scan?.verdict ?? 'none'
  return <Seal tone={TONES[verdict]} label={t(`admin.verdicts.${verdict}`)} />
}
