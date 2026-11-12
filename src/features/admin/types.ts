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

export type User = components['schemas']['UserOut']
export type UserPage = components['schemas']['Page_UserOut_']
export type Group = components['schemas']['GroupOut']
export type GroupPage = components['schemas']['Page_GroupOut_']
export type AuditEvent = components['schemas']['AuditEventOut']
export type AuditPage = components['schemas']['Page_AuditEventOut_']
export type Verification = components['schemas']['VerificationOut']

export type Node = components['schemas']['NodeOut']
export type NodePage = components['schemas']['Page_NodeOut_']
export type Enrollment = components['schemas']['AdminEnrollmentOut']
export type EnrollmentPage = components['schemas']['Page_AdminEnrollmentOut_']
export type Approval = components['schemas']['ApprovalOut']
