import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import { refusal } from './failures'
import type { AdminFile, AdminFilePage, ReleaseRequest, Verdict } from './types'

export const PAGE_SIZE = 20
/** How often a file waiting for its verdict is asked again. */
export const POLL_MS = 3000

const filesKey = ['admin', 'files'] as const
const fileKey = (fileId: string) => [...filesKey, 'one', fileId] as const

const waiting = (file: AdminFile) =>
  file.status === 'uploaded' && (file.scan === null || file.scan.verdict === 'pending')

/** Every user's uploaded files, newest first, optionally only those with one verdict. */
export function useAdminFiles(verdict: Verdict | null, page: number) {
  const api = useApi()
  return useQuery({
    queryKey: [...filesKey, 'list', verdict, page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<AdminFilePage> => {
      const { data, response } = await api.GET('/admin/files', {
        params: { query: { verdict, limit: PAGE_SIZE, offset: page * PAGE_SIZE } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
    refetchInterval: (query) => (query.state.data?.items.some(waiting) ? POLL_MS : false),
  })
}

/** One file, asked again while it waits for a verdict (after a rescan, say). */
export function useAdminFile(fileId: string) {
  const api = useApi()
  return useQuery({
    queryKey: fileKey(fileId),
    retry: false,
    queryFn: async ({ signal }): Promise<AdminFile> => {
      const { data, response } = await api.GET('/admin/files/{file_id}', {
        params: { path: { file_id: fileId } },
        signal,
      })
      if (!data) throw refusal(response.status)
      return data
    },
    refetchInterval: (query) => (query.state.data && waiting(query.state.data) ? POLL_MS : false),
  })
}

function useFileMutation<Variables>(
  fileId: string,
  request: (variables: Variables) => Promise<{ data?: AdminFile; response: Response }>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (variables: Variables) => {
      const { data, response } = await request(variables)
      if (!data) throw refusal(response.status)
      return data
    },
    onSuccess: (file) => {
      queryClient.setQueryData(fileKey(fileId), file)
      return queryClient.invalidateQueries({ queryKey: [...filesKey, 'list'] })
    },
  })
}

/** Lets the owner download, or share, a quarantined or unscannable file. */
export function useRelease(fileId: string) {
  const api = useApi()
  return useFileMutation(fileId, (body: ReleaseRequest) =>
    api.POST('/admin/files/{file_id}/release', { params: { path: { file_id: fileId } }, body }),
  )
}

/** Scans the file again: its findings and releases go, and it waits for a new verdict. */
export function useRescan(fileId: string) {
  const api = useApi()
  return useFileMutation(fileId, () =>
    api.POST('/admin/files/{file_id}/rescan', { params: { path: { file_id: fileId } } }),
  )
}
