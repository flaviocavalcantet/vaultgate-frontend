import type { components } from '@/api/schema'

export type AdminFile = components['schemas']['AdminFileOut']
export type AdminFilePage = components['schemas']['Page_AdminFileOut_']
export type Verdict = components['schemas']['ScanOut']['verdict']
export type ReleaseRequest = components['schemas']['ReleaseRequest']
export type Purpose = NonNullable<ReleaseRequest['purpose']>

export const VERDICTS: readonly Verdict[] = ['pending', 'clean', 'quarantined', 'unscannable']
