import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import { refusal } from './failures'
import { shareLink } from './link'
import type { ShareCreate, ShareOut } from './types'

const sharesKey = (fileId: string) => ['shares', fileId] as const

/** The file being shared: its name and whether its scan lets it be shared. */
export function useSharedFile(fileId: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['file', fileId],
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/files/{file_id}', {
        params: { path: { file_id: fileId } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
    retry: false,
  })
}

/** The file's shares, newest first, with their state. */
export function useShares(fileId: string) {
  const api = useApi()
  return useQuery({
    queryKey: sharesKey(fileId),
    queryFn: async ({ signal }): Promise<ShareOut[]> => {
      const { data, response } = await api.GET('/files/{file_id}/shares', {
        params: { path: { file_id: fileId } },
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
export function useCreateShare(fileId: string, origin = window.location.origin) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ShareCreate): Promise<NewShare> => {
      const { data, response } = await api.POST('/files/{file_id}/shares', {
        params: { path: { file_id: fileId } },
        body,
      })
      if (!data) throw refusal(response.status)
      return { share: data.share, link: shareLink(origin, data.token) }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharesKey(fileId) }),
  })
}

/** Revokes a share at once; revoking one already revoked is fine. */
export function useRevokeShare(fileId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { response } = await api.DELETE('/files/{file_id}/shares/{share_id}', {
        params: { path: { file_id: fileId, share_id: shareId } },
      })
      if (!response.ok) throw refusal(response.status)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: sharesKey(fileId) }),
  })
}
