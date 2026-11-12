import { useMutation } from '@tanstack/react-query'

import { useApi } from '@/api/useApi'
import { submitDownload } from '@/components/download'

/** Why a download intent was refused, in terms a user can act on. */
export type DownloadFailure = 'unavailable' | 'notFound' | 'denied' | 'unknown'

export class DownloadRefused extends Error {
  override name = 'DownloadRefused'
  readonly reason: DownloadFailure

  constructor(reason: DownloadFailure) {
    super(reason)
    this.reason = reason
  }
}

function failure(status: number): DownloadFailure {
  if (status === 409) return 'unavailable'
  if (status === 404) return 'notFound'
  if (status === 403) return 'denied'
  return 'unknown'
}

/**
 * Asks the API for a download intent just before using it (it lasts minutes and works
 * once), then hands it to the browser's downloader.
 */
export function useDownload() {
  const api = useApi()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data, response } = await api.POST('/files/{file_id}/download', {
        params: { path: { file_id: fileId } },
      })
      if (!data) throw new DownloadRefused(failure(response.status))
      submitDownload(data)
    },
  })
}
