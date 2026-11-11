import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'

import type { FileOut, FilePage } from './types'

export const PAGE_SIZE = 20
export const filesKey = ['files'] as const
/** How often the list is asked again while a file is still being uploaded or scanned. */
export const POLL_MS = 3000

/** Still changing on the server: an upload in progress, or a scan not done. */
export function settling(file: FileOut): boolean {
  if (file.status === 'pending' || file.status === 'uploading') return true
  return file.status === 'uploaded' && (file.scan === null || file.scan.verdict === 'pending')
}

/** One page of the caller's files, newest first; asked again while any is settling. */
export function useFiles(page: number) {
  const api = useApi()
  return useQuery({
    queryKey: [...filesKey, page],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<FilePage> => {
      const { data, response } = await api.GET('/files', {
        params: { query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE } },
        signal,
      })
      if (!data) throw new Error(`GET /files answered ${response.status}`)
      return data
    },
    refetchInterval: (query) => (query.state.data?.items.some(settling) ? POLL_MS : false),
  })
}
