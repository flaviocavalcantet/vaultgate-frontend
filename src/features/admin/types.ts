import type { components } from '@/api/schema'

export type AdminFile = components['schemas']['AdminFileOut']
export type AdminFilePage = components['schemas']['Page_AdminFileOut_']
export type Verdict = components['schemas']['ScanOut']['verdict']
export type ReleaseRequest = components['schemas']['ReleaseRequest']
export type Purpose = NonNullable<ReleaseRequest['purpose']>

export const VERDICTS: readonly Verdict[] = ['pending', 'clean', 'quarantined', 'unscannable']

export type Policy = components['schemas']['PolicyOut']
export type PolicyIn = components['schemas']['PolicyIn']
export type PolicyPage = components['schemas']['Page_PolicyOut_']
export type Action = PolicyIn['actions'][number]
export type EvaluateIn = components['schemas']['EvaluateIn']
export type Evaluation = components['schemas']['EvaluateOut']

export const ACTIONS: readonly Action[] = ['read', 'upload', 'download', 'share', 'enroll']
