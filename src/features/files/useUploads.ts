import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useApi } from '@/api/useApi'

import { UploadAborted, UploadError, uploadToGateway } from './gateway'
import { filesKey } from './useFiles'

export type UploadState =
  | { phase: 'registering' }
  | { phase: 'sending'; sent: number; total: number }
  | { phase: 'done' }
  | { phase: 'cancelled' }
  | { phase: 'failed'; reason: UploadFailure }

/** Why an upload failed, in terms a user can act on. */
export type UploadFailure = 'tooLarge' | 'tooMany' | 'refused' | 'unreachable' | 'unknown'

export interface Upload {
  id: string
  name: string
  size: number
  state: UploadState
}

const DEFAULT_TYPE = 'application/octet-stream'
// The API's own rule for a media type (type/subtype, RFC 6838 token characters).
const MEDIA_TYPE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/

/** The file's type as the browser guessed it, if the API will take it; else the default. */
export function mediaType(file: File): string {
  return MEDIA_TYPE.test(file.type) ? file.type : DEFAULT_TYPE
}

function failure(status: number): UploadFailure {
  if (status === 413) return 'tooLarge'
  if (status === 429) return 'tooMany'
  if (status === 0) return 'unreachable'
  if (status === 401 || status === 403 || status === 409) return 'refused'
  return 'unknown'
}

/**
 * Uploads in this page: each file is registered with the API (which hands back a
 * single-use upload intent) and its bytes sent to the gateway, with progress. The list
 * of files is refreshed when one finishes; the scan then runs on the server.
 */
export function useUploads() {
  const api = useApi()
  const queryClient = useQueryClient()
  const [uploads, setUploads] = useState<Upload[]>([])
  const controllers = useRef(new Map<string, AbortController>())

  // Leaving the page cancels what is still sending.
  useEffect(() => {
    const running = controllers.current
    return () => running.forEach((controller) => controller.abort())
  }, [])

  const update = useCallback((id: string, state: UploadState) => {
    setUploads((all) => all.map((upload) => (upload.id === id ? { ...upload, state } : upload)))
  }, [])

  const start = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID()
      const controller = new AbortController()
      controllers.current.set(id, controller)
      setUploads((all) => [
        { id, name: file.name, size: file.size, state: { phase: 'registering' } },
        ...all,
      ])
      try {
        const { data, response } = await api.POST('/files', {
          body: { name: file.name, size: file.size, content_type: mediaType(file) },
          signal: controller.signal,
        })
        if (!data) {
          update(id, { phase: 'failed', reason: failure(response.status) })
          return
        }
        update(id, { phase: 'sending', sent: 0, total: file.size })
        await uploadToGateway(
          data.upload,
          file,
          (sent, total) => update(id, { phase: 'sending', sent, total }),
          controller.signal,
        )
        update(id, { phase: 'done' })
      } catch (error) {
        if (error instanceof UploadAborted || controller.signal.aborted) {
          update(id, { phase: 'cancelled' })
        } else if (error instanceof UploadError) {
          update(id, { phase: 'failed', reason: failure(error.status) })
        } else {
          console.error(error)
          update(id, { phase: 'failed', reason: 'unknown' })
        }
      } finally {
        controllers.current.delete(id)
        // Registered files show in the list whatever happened next (failed, abandoned).
        void queryClient.invalidateQueries({ queryKey: filesKey })
      }
    },
    [api, queryClient, update],
  )

  const cancel = useCallback((id: string) => controllers.current.get(id)?.abort(), [])
  const dismiss = useCallback(
    (id: string) => setUploads((all) => all.filter((upload) => upload.id !== id)),
    [],
  )

  return { uploads, start, cancel, dismiss }
}
