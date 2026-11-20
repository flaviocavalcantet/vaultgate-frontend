import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import type { FolderDetail, FolderPage, FolderTotals, Item } from './types'
import { filesKey } from './useFiles'

export const foldersKey = ['folders'] as const
/** The API lists at most this many folders in one; a folder rarely holds more. */
const FOLDER_LIMIT = 500

/**
 * Why a change to a file or folder was refused, in terms a user can act on. The API
 * says which with a 409's detail (vaultgate ADR 0020); its words are matched here and
 * never shown, so every message stays translatable.
 */
export type ChangeFailure =
  'nameTaken' | 'intoItself' | 'tooDeep' | 'invalidName' | 'notFound' | 'denied' | 'unknown'

export class ChangeRefused extends Error {
  override name = 'ChangeRefused'
  readonly reason: ChangeFailure

  constructor(reason: ChangeFailure) {
    super(reason)
    this.reason = reason
  }
}

export function changeFailure(status: number, detail: unknown): ChangeFailure {
  const text = typeof detail === 'string' ? detail : ''
  if (status === 409 && text.includes('already here')) return 'nameTaken'
  if (status === 409 && text.includes('into itself')) return 'intoItself'
  if (status === 409 && text.includes('nest at most')) return 'tooDeep'
  if (status === 422) return 'invalidName'
  if (status === 404) return 'notFound'
  if (status === 403) return 'denied'
  return 'unknown'
}

/** The refusal, from the status and the body openapi-fetch already parsed. */
function refused(response: Response, error: unknown): ChangeRefused {
  const detail = (error as { detail?: unknown } | undefined)?.detail
  return new ChangeRefused(changeFailure(response.status, detail))
}

/** A folder of the caller's with its path from the top level; none for the top level. */
export function useFolder(folderId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: [...foldersKey, 'one', folderId],
    enabled: folderId !== undefined,
    // Not found is final; anything else gets the usual one retry.
    retry: (count, error) =>
      !(error instanceof ChangeRefused && error.reason === 'notFound') && count < 1,
    queryFn: async ({ signal }): Promise<FolderDetail> => {
      const { data, error, response } = await api.GET('/folders/{folder_id}', {
        params: { path: { folder_id: folderId! } },
        signal,
      })
      if (!data) throw refused(response, error)
      return data
    },
  })
}

/** The folders in a folder (none: the top level), by name. */
export function useSubfolders(parentId: string | undefined, enabled = true) {
  const api = useApi()
  return useQuery({
    queryKey: [...foldersKey, 'in', parentId ?? null],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<FolderPage> => {
      const { data, error, response } = await api.GET('/folders', {
        params: {
          query: parentId ? { parent_id: parentId, limit: FOLDER_LIMIT } : { limit: FOLDER_LIMIT },
        },
        signal,
      })
      if (!data) throw refused(response, error)
      return data
    },
  })
}

/** What a folder holds at every level: what deleting it would delete. */
export function useFolderTotals(folderId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: [...foldersKey, 'totals', folderId],
    enabled: folderId !== undefined,
    // Always fresh: it is read just before asking to delete.
    staleTime: 0,
    queryFn: async ({ signal }): Promise<FolderTotals> => {
      const { data, error, response } = await api.GET('/folders/{folder_id}/totals', {
        params: { path: { folder_id: folderId! } },
        signal,
      })
      if (!data) throw refused(response, error)
      return data
    },
  })
}

/** Changes to files and folders; each refreshes the lists when it succeeds. */
export function useChanges() {
  const api = useApi()
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: filesKey }),
      queryClient.invalidateQueries({ queryKey: foldersKey }),
    ])

  const create = useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId: string | undefined }) => {
      const { data, error, response } = await api.POST('/folders', {
        body: { name, parent_id: parentId ?? null },
      })
      if (!data) throw refused(response, error)
      return data
    },
    onSuccess: refresh,
  })

  const rename = useMutation({
    mutationFn: async ({ target, name }: { target: Item; name: string }) => {
      const { error, response } =
        target.kind === 'file'
          ? await api.PATCH('/files/{file_id}', {
              params: { path: { file_id: target.item.id } },
              body: { name },
            })
          : await api.PATCH('/folders/{folder_id}', {
              params: { path: { folder_id: target.item.id } },
              body: { name },
            })
      if (!response.ok) throw refused(response, error)
    },
    onSuccess: refresh,
  })

  const move = useMutation({
    mutationFn: async ({ target, to }: { target: Item; to: string | null }) => {
      const { error, response } =
        target.kind === 'file'
          ? await api.PATCH('/files/{file_id}', {
              params: { path: { file_id: target.item.id } },
              body: { folder_id: to },
            })
          : await api.PATCH('/folders/{folder_id}', {
              params: { path: { folder_id: target.item.id } },
              body: { parent_id: to },
            })
      if (!response.ok) throw refused(response, error)
    },
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: async (target: Item) => {
      const { error, response } =
        target.kind === 'file'
          ? await api.DELETE('/files/{file_id}', {
              params: { path: { file_id: target.item.id } },
            })
          : await api.DELETE('/folders/{folder_id}', {
              params: { path: { folder_id: target.item.id } },
            })
      if (!response.ok) throw refused(response, error)
    },
    onSuccess: refresh,
  })

  return { create, rename, move, remove }
}
