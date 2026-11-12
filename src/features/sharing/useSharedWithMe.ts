import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'
import { submitDownload } from '@/components/download'

import { refusal } from './failures'
import type { SharedFile } from './types'

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

/** Asks for a download intent for a shared file and hands it to the browser. */
export function useSharedDownload() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { data, response } = await api.POST('/shared-with-me/{share_id}/download', {
        params: { path: { share_id: shareId } },
      })
      if (!data) throw refusal(response.status)
      submitDownload(data)
    },
    // The download counts against the share: its downloads left change.
    onSettled: () => queryClient.invalidateQueries({ queryKey: sharedKey }),
  })
}
