import { useMutation, useQuery } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'
import { submitDownload } from '@/components/download'

import { refusal } from './failures'
import type { Grant, ShareAccess } from './types'

/**
 * The recipient's side of a share link (vaultgate M5): what the link is, a code sent to
 * the share's address, the code checked for a grant, and downloads with the grant. No
 * account: the token and the grant are the recipient's only credentials, and live in
 * memory only.
 */
export function useShareAccess(token: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: ['share-access', token],
    enabled: token !== null,
    retry: false,
    queryFn: async ({ signal }): Promise<ShareAccess> => {
      const { data, response } = await api.GET('/shares/access', {
        params: { query: { token: token ?? '' } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

export function useSendCode(token: string) {
  const api = useApi()
  return useMutation({
    mutationFn: async (): Promise<{ sentTo: string | null }> => {
      const { data, response } = await api.POST('/shares/access/code', { body: { token } })
      if (!data) throw refusal(response.status)
      return { sentTo: typeof data.sent_to === 'string' ? data.sent_to : null }
    },
  })
}

export function useVerifyCode(token: string) {
  const api = useApi()
  return useMutation({
    mutationFn: async (code: string): Promise<Grant> => {
      const { data, response } = await api.POST('/shares/access/verify', {
        body: { token, code },
      })
      if (!data) throw refusal(response.status)
      return data
    },
  })
}

export function useShareDownload(token: string) {
  const api = useApi()
  return useMutation({
    mutationFn: async (grant: string) => {
      const { data, response } = await api.POST('/shares/access/downloads', {
        body: { token, grant },
      })
      if (!data) throw refusal(response.status)
      submitDownload(data)
    },
  })
}
