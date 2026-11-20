import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'
import { submitDownload } from '@/components/download'

import { refusal } from './failures'
import type { SharedContents, SharedFile } from './types'

const sharedKey = ['shared-with-me'] as const

/** Files other users shared with the caller's verified address, still active. */
export function useSharedWithMe() {
  const api = useApi()
  return useQuery({
    queryKey: sharedKey,
    queryFn: async ({ signal }): Promise<SharedFile[]> => {
      const { data, response } = await api.GET('/shared-with-me', { signal })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

/** A folder of a folder shared with the caller (none: the shared folder itself). */
export function useSharedContents(shareId: string, folderId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: [...sharedKey, shareId, 'contents', folderId ?? null],
    // The folder shown stays until the next one is in (and focus with it).
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<SharedContents> => {
      const { data, response } = await api.GET('/shared-with-me/{share_id}/contents', {
        params: {
          path: { share_id: shareId },
          ...(folderId ? { query: { folder_id: folderId } } : {}),
        },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
    retry: false,
  })
}

/**
 * Asks for a download intent for a shared file, or a file in a shared folder
 * (`fileId`), and hands it to the browser.
 */
export function useSharedDownload() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ shareId, fileId }: { shareId: string; fileId?: string }) => {
      const { data, response } = await api.POST('/shared-with-me/{share_id}/download', {
        params: {
          path: { share_id: shareId },
          ...(fileId ? { query: { file_id: fileId } } : {}),
        },
      })
      if (!data) throw refusal(response.status)
      submitDownload(data)
    },
    // The download counts against the share: its downloads left change.
    onSettled: () => queryClient.invalidateQueries({ queryKey: sharedKey }),
  })
}
