import type { components } from '@/api/schema'

export type FileOut = components['schemas']['FileOut']
export type FilePage = components['schemas']['FilePage']
export type Transfer = components['schemas']['TransferOut']
export type FolderOut = components['schemas']['FolderOut']
export type FolderDetail = components['schemas']['FolderDetail']
export type FolderPage = components['schemas']['FolderPage']
export type FolderTotals = components['schemas']['FolderTotals']

/** Something in a folder that can be renamed, moved or deleted. */
export type Item = { kind: 'file'; item: FileOut } | { kind: 'folder'; item: FolderOut }
