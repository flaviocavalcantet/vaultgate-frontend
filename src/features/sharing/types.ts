import type { components } from '@/api/schema'

export type ShareOut = components['schemas']['ShareOut']
export type ShareCreate = components['schemas']['ShareCreate']
export type SharedFile = components['schemas']['SharedFileOut']
export type ShareAccess = components['schemas']['AccessOut']
export type Grant = components['schemas']['GrantOut']
export type SharedContents = components['schemas']['SharedContents']
export type SharedFileItem = components['schemas']['SharedFileItem']

/** What an owner shares: one of their files, or one of their folders. */
export interface ShareTarget {
  kind: 'file' | 'folder'
  id: string
}
