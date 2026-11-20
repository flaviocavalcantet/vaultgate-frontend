import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import { refusal } from './failures'
import { shareLink } from './link'
import type { ShareCreate, ShareOut, ShareTarget } from './types'

const sharesKey = (target: ShareTarget) => ['shares', target.kind, target.id] as const

/** What the owner shares, as the page needs it. */
export interface Shared {
  name: string
  /** A file its scan keeps from sharing gets no new link; a folder's files are checked one by one. */
  shareable: boolean
  /** Where the owner goes back to: the folder the file is in, or the folder itself. */
  folderId: string | null
}

/** The file or folder being shared: its name, and whether a new link can be made. */
export function useSharedTarget(target: ShareTarget) {
  const api = useApi()
  return useQuery({
    queryKey: ['share-target', target.kind, target.id],
    queryFn: async ({ signal }): Promise<Shared> => {
      if (target.kind === 'file') {
        const { data, response } = await api.GET('/files/{file_id}', {
          params: { path: { file_id: target.id } },
          signal,
        })
        if (!data) throw refusal(response.status)
        return { name: data.name, shareable: data.shareable, folderId: data.folder_id }
      }
      const { data, response } = await api.GET('/folders/{folder_id}', {
        params: { path: { folder_id: target.id } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return { name: data.name, shareable: true, folderId: data.id }
    },
    retry: false,
  })
}

/** The file's or folder's shares, newest first, with their state. */
export function useShares(target: ShareTarget) {
  const api = useApi()
  return useQuery({
    queryKey: sharesKey(target),
    queryFn: async ({ signal }): Promise<ShareOut[]> => {
      const { data, response } =
        target.kind === 'file'
          ? await api.GET('/files/{file_id}/shares', {
              params: { path: { file_id: target.id } },
              signal,
            })
          : await api.GET('/folders/{folder_id}/shares', {
              params: { path: { folder_id: target.id } },
              signal,
            })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

export interface NewShare {
  share: ShareOut
  /** The link to send, shown once: the API keeps only a hash of its token. */
  link: string
}

/** Creates a share and builds its link to this app's recipient page. */
export function useCreateShare(target: ShareTarget, origin = window.location.origin) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ShareCreate): Promise<NewShare> => {
      const { data, response } =
        target.kind === 'file'
          ? await api.POST('/files/{file_id}/shares', {
              params: { path: { file_id: target.id } },
              body,
            })
          : await api.POST('/folders/{folder_id}/shares', {
              params: { path: { folder_id: target.id } },
              body,
            })
      if (!data) throw refusal(response.status)
      return { share: data.share, link: shareLink(origin, data.token) }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharesKey(target) }),
  })
}

/** Revokes a share at once; revoking one already revoked is fine. */
export function useRevokeShare(target: ShareTarget) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { response } =
        target.kind === 'file'
          ? await api.DELETE('/files/{file_id}/shares/{share_id}', {
              params: { path: { file_id: target.id, share_id: shareId } },
            })
          : await api.DELETE('/folders/{folder_id}/shares/{share_id}', {
              params: { path: { folder_id: target.id, share_id: shareId } },
            })
      if (!response.ok) throw refusal(response.status)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: sharesKey(target) }),
  })
}
